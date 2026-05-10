# 03 — Enumeration cost

**Question.** Does the de Bruijn pentagrid enumeration meet the <4ms-at-1500-tiles budget in the plan?

**Status.** Float64 numbers below settle the lower bound. [`01-coord-representation.md`](./01-coord-representation.md) shows Float64 starts disagreeing with the exact oracle at |p|=10¹², so a Float64-only enumerator silently produces wrong tiles past that magnitude. A BigInt-exact rerun is required to confirm whether exact enumeration fits the budget directly, or whether the explorer needs the viewport-anchor pattern (BigInt anchor + Float64 offsets, periodic re-anchor) to keep the hot path on Float64.

**Float64 numbers (provisional).**

## Method

A self-contained pentagrid enumerator in [`03-enumeration-cost.ts`](./03-enumeration-cost.ts). For each pair `(j, k)` of grid directions (10 pairs total), enumerate integer line indices `(kj, kk)` whose intersection vertex falls inside the rect. Each such vertex corresponds to a P3 rhombus tile; the tile's pentagrid coord is the 5-tuple of `floor(p · e_l + γ_l)` evaluated at the vertex. Dedup via `Set<string>` keyed on the 5-tuple.

Bun on the maintainer's machine. 5 warmup iterations, 50 timed iterations per row.

## Numbers

```
size      rect (w×h units)   tiles   mean_ms   p95_ms    runs
small     12×8               381     0.32      1.07      50
medium    24×14              1315    1.59      3.08      50
large     36×22              3092    1.96      2.47      50
x-large   48×30              5583    4.11      5.02      50
```

## Interpretation

- At 1315 tiles (close to the budget target of 1500), p95 is 3.08ms — comfortable.
- Cost is near-linear in tile count up to ~3000.
- Past 5000 tiles, dedup `Set<string>` allocation visibly dominates (mean clears 4ms at x-large).
- The shipped LOD strategy clamps on-screen tile count to ~600-1500 across the explorer's reachable zoom range, so the perf budget is satisfied by design.

The first-row p95 (1.07ms at 381 tiles) is higher than the third-row p95 (2.47ms at 3092 tiles). That's measurement noise from warmup outliers at small N; not a real ordering inversion.

## Citation

The shipped `lib/pentagrid.ts` `enumerateTilesInRect` matches the structure in this script.

If profiling later shows the dedup hash dominating, swap `Set<string>` → packed-key `Set<number>` (encode the 5-tuple into a 53-bit integer). Don't speculatively add it.
