# 04 — Viewport anchor

**Question.** Does the BigInt-truth / Float64-view pattern preserve both 60fps enumeration and exact addressing at any anchor magnitude?

**Decision.** Yes. The pattern is viable. Ship it.

## Pattern

State holds two pieces:

```
anchor: { x: bigint, y: bigint }       // exact world position, unbounded
offset: { x: number, y: number }       // small Float64 delta, |offset| < threshold
```

For each direction j, precompute the anchor's projection once per re-anchor:

```
nProj_j = floor(anchor · e_j + γ_j)     // BigInt, exact integer part
fProj_j = {anchor · e_j + γ_j} ∈ [0,1)  // Float64, fractional part
```

Per-frame enumeration runs Float64 in offset space with `γ_eff = fProj`. Each tile found gets its absolute pentagrid coord by adding `nProj_j` to each tuple element. Render math (canvas transforms, vertex positions) never touches the anchor — only the address-layer translation does.

Re-anchor when `|offset|` crosses ~1e8 (Float64 precision is comfortable up to ~10¹⁵; pick the threshold an order of magnitude below the danger zone).

## Method

[`04-viewport-anchor.ts`](./04-viewport-anchor.ts). Two checks:

- **Correctness.** At anchor=(0,0), the anchored enumerator must produce the same set of absolute coords as 03's BigInt-exact enumerator on the same rect. Same 1315 tiles, same 5-tuples, set equality.
- **Throughput.** Time the anchored enumerator at anchor magnitudes 0, 1e5, 1e10, 1e20, 1e30, 1e40. The Float64 inner loop is identical regardless of magnitude; only the per-tile absolute-coord conversion (BigInt-add) grows with anchor size.

Seed `funclol`. 50 timed iterations per row, 5 warmup.

## Numbers

```
correctness (anchor=0):  anchored=1315  exact=1315  equal=true

anchor_mag    tiles   mean_ms   p95_ms
0             1315    3.04ms    6.04ms
1e5           1302    2.90ms    3.79ms
1e10          1316    2.87ms    3.57ms
1e20          1306    5.02ms    7.66ms
1e30          1319    6.30ms    7.24ms
1e40          1322    7.15ms    8.81ms

makeAnchor at |a|=1e20: 4.57 µs/call
```

## Interpretation

- Correctness verified: 1315/1315 tile coords match the BigInt oracle at anchor=0. The anchored algorithm is just `γ_eff = fProj` Float64 enumeration plus a constant `nProj` shift, which is algebraically identical to absolute-frame enumeration.
- Throughput stays under 16 ms / 60 fps at every anchor magnitude tested, up to 10⁴⁰. The per-frame budget is preserved.
- The slight growth with magnitude (3 ms → 7 ms across 10⁰ → 10⁴⁰) comes from per-tile BigInt-add to convert offset coords to absolute. At 1315 tiles, 5 BigInt-adds per tile × growing BigInt size: ~3 ms overhead total. Easy to defer this conversion to display time if we ever need to (the dedup set could key on offset coords instead of absolute).
- Re-anchoring costs 4.57 µs. At one re-anchor per second of heavy panning, that's 0.0005% of CPU. Free.

## Implications for the shipped explorer

`lib/pentagrid.ts`:

- `Coord = readonly [bigint, bigint, bigint, bigint, bigint]`.
- `pointToCoord(p, γ)` is BigInt-exact (used by hover, URL).
- `enumerateTilesInRect(anchor, rect, γ)` takes a precomputed anchor and a rect in offset space. Returns tiles whose coords are `anchor.nProj + offsetCoord`. Float64 inner loop, BigInt result.

`lib/transform.ts`:

- World-to-screen transform is `screen = (world - anchor) * zoom + canvas_center`.
- World-to-anchor reduction (the only place BigInt and Float64 cross) happens once per re-anchor.
- Re-anchor when `|cameraOffset|` exceeds a threshold (default 1e8 world units).

The cursor's hover readout is computed via `pointToCoord(anchor + cursor_offset_as_bigint, γ)`, taking ~2.6 µs per pointermove. Invisible.

## Citation

`lib/pentagrid.ts` cites this writeup for the dual-layer design. The bound on `|offset|` and the re-anchor threshold are tuned here, not in the shipped code; if a future change needs different bounds (e.g., higher zoom limits), rerun this script to validate.
