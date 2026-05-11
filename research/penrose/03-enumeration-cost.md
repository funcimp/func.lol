# 03 — Enumeration cost

**Question.** How fast is `enumerateTilesInRect` in Float64 vs in BigInt-exact, and what does the gap imply for the explorer's per-frame budget?

## Method

A self-contained pentagrid enumerator, twice. Both implementations iterate the same 10 direction-pairs, compute the same line-index bounds, solve for the same intersection vertices, and produce the same 5-tuples. The only difference is the arithmetic backend: one in Float64, one in BigInt with the algebraic constants from [`01-coord-representation.ts`](./01-coord-representation.ts) at `SCALE = 10⁵⁰`.

Bun on the maintainer's machine. 3 warmup iterations per implementation, 50 timed iterations per row. Seed `funclol`. Script: [`03-enumeration-cost.ts`](./03-enumeration-cost.ts).

## Numbers

```
size     rect    tiles   float64 mean   float64 p95   exact mean   exact p95   ratio
small    12×8    381     0.84ms         4.73ms        9.97ms       13.36ms     11.9×
medium   24×14   1315    1.89ms         3.11ms        29.05ms      35.64ms     15.4×
large    36×22   3092    2.65ms         3.78ms        56.88ms      69.50ms     21.4×
x-large  48×30   5583    5.04ms         6.90ms        83.57ms      96.58ms     16.6×
```

Per-tile cost at the budget target (1315 tiles): Float64 1.44 µs/tile, exact 22.1 µs/tile. The 20.7 µs/tile gap is the perf tax for BigInt arithmetic in the hot path.

## Interpretation

- Float64 fits the 16 ms frame budget at any rect size tested. Mean stays well under 6 ms even at 5500 tiles.
- BigInt-exact misses the 16 ms budget starting at the medium rect (~1300 tiles → 29 ms mean, ~35 ms p95). At typical zoom levels for the explorer, exact-throughout panning runs at ~33 fps, not 60.
- BigInt-exact stays under a 33 ms / 30 fps budget through ~1500 tiles, then drops below 30 fps for denser viewports.
- Hover and URL paths are unaffected — they're called once per event in absolute µs, not per-frame.

## Implications for the shipped explorer

Three viable shapes for the addressing-and-render pipeline:

1. **Exact throughout.** Simplest. Address and render both in BigInt. Panning runs at ~33 fps for medium viewports, drops below 30 fps for dense ones. Acceptable for a contemplative explorer; not great for a tactile pan / zoom feel.
2. **Viewport-anchor hybrid.** Address layer in BigInt (correct at any size). Render in Float64 relative to a BigInt anchor, re-anchored when offsets grow past a precision threshold (e.g., 1e8). Hot path stays at Float64 speed (60 fps), addressing stays exact. Extra ~150 lines of anchor management.
3. **Bounded-precision BigInt.** Same shape as exact-throughout, but with `SCALE = 10²⁰` instead of `10⁵⁰`. BigInt mul becomes ~4× cheaper (smaller limb count). Projected ~7 ms at 1500 tiles, inside the 16 ms budget. Correctness ceiling drops from 10⁴⁹ to ~10¹⁹ — still vastly past any reachable position. Not literally infinite though.

The viewport-anchor pattern (2) is the canonical infinite-canvas approach and keeps both correctness and frame-rate. The bounded-precision option (3) is a smaller change and worth measuring before committing if simpler-throughout is preferred over literally-infinite.

## Citation

`lib/pentagrid.ts` `enumerateTilesInRect` uses pattern (2) or (3) depending on the maintainer's call. Either way, `Coord = readonly [bigint, ...]` (per [`01-coord-representation.md`](./01-coord-representation.md)) so the addressing layer is exact regardless of the render path.

If profiling later shows the dedup hash dominating in either backend, swap `Set<string>` → packed-key `Set<number>` (encode the 5-tuple into 53 bits when coords are small).
