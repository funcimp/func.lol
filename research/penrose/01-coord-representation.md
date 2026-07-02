# 01 — Coord representation

**Question.** Where does Float64 disagree with a high-precision oracle for pentagrid `pointToCoord`, and what does the oracle cost?

**Decision.** Ship `Coord = readonly [bigint, bigint, bigint, bigint, bigint]` with BigInt-exact math for hover and URL. The address layer stays exact at any size. Per-frame rendering may fall back to a Float64 viewport-anchor pattern if `03` confirms the budget forces it; that's a render-only optimization, not an addressing compromise.

## Method

Two implementations of `pointToCoord`, called on the same input:

- **Exact.** BigInt arithmetic. Constants computed algebraically inside the script:
  - `√5` via `bigintSqrt(5 · SCALE²)`
  - `cos(2πj/5) = (±√5 ± 1) / 4`
  - `sin(2πj/5) = √(10 ± 2√5) / 4` (via `bigintSqrt` again)
  - `SCALE = 10⁵⁰`. The floor of the projection is provably correct for magnitudes well below the SCALE ceiling.
- **Float64.** Straight `Math.floor(px · cos + py · sin + γ)`.

For each magnitude R, sample 1000 random points. The point is generated as a BigInt (the canonical "intended" position); both implementations receive equivalent inputs — Float64 gets the cast version. Compare the resulting 5-tuples coord-by-coord. Any element-wise mismatch counts as disagreement.

Seed `funclol`. Script: [`01-coord-representation.ts`](./01-coord-representation.ts).

## Numbers

```
|p|       agree     disagree
0         100.0%    0.0%
1e+3      100.0%    0.0%
1e+6      100.0%    0.0%
1e+9      100.0%    0.0%
1e+12     99.8%     0.2%      <- first disagreement
1e+13     99.0%     1.0%
1e+14     86.4%     13.6%
1e+15     55.9%     44.1%
1e+18     0.0%      100.0%
1e+24     0.0%      100.0%
1e+30     0.0%      100.0%
1e+40     0.0%      100.0%
```

Throughput, sampled at |p|=10⁶, 50,000 calls:

```
exact:    2.58 µs/call
float64:  0.13 µs/call    (~20× faster)
```

## Interpretation

- Float64 first disagrees at |p|=10¹² (0.2%). Float64 ULP at 10¹² is ≈ 2.2e-4; tile widths are O(1); a 2e-4 absolute error puts ≈0.04% of points within ε of a tile boundary, which roughly matches the observed rate.
- The rate climbs steeply: by 10¹⁴ (ULP ≈ 2.2e-2) it's 14%; by 10¹⁵ (ULP ≈ 0.22) it's 44%; by 10¹⁸ it's complete.
- Exact stays correct across the full tested range.
- Exact is ~20× slower per call. Absolute cost is 2.58 µs, invisible in human-paced contexts (hover, URL share).

The earlier script's "no flicker up to 10¹²" result was a methodology artifact: an ε=1e-9 displacement vanishes into Float64 quantization at high R, so identical inputs trivially produced identical outputs. The new comparison against an oracle exposes the real failure boundary.

## Implications for the shipped explorer

- `Coord = readonly [bigint, bigint, bigint, bigint, bigint]`. No Float64 in the address layer.
- `pointToCoord` uses the exact implementation for the hover readout and URL state. Per-event cost is in the µs range — not a concern.
- Per-frame `enumerateTilesInRect`: not yet tested in BigInt. The Float64 version runs in 1.59 ms mean at 1315 tiles ([`03-enumeration-cost.md`](./03-enumeration-cost.md)); a naive BigInt version is ~20× slower (≈30 ms), outside the 16 ms frame budget. A viewport-anchor pattern (BigInt anchor + Float64 offsets, periodic re-anchor) preserves rendering correctness at any anchor magnitude while keeping the hot path on Float64. Q3 needs a follow-up benchmark before committing.
- URL coord codec must accept BigInt. Q2 needs a follow-up with BigInt base62.

## Caveats

- The "exact" oracle here has a precision ceiling near magnitude 10⁴⁹ (where the BigInt projection error reaches the integer floor threshold given `SCALE = 10⁵⁰`). Beyond that the oracle itself drifts. Adaptive `SCALE` (grow with the magnitude under test) would push the ceiling arbitrarily high. Not implemented; not needed for any reach a user can pan to in a lifetime.
- The cyclotomic ring ℤ[ζ₅] is the genuinely-unbounded substrate (no `SCALE` at all — elements are 4-tuples of BigInts, addition / multiplication are exact, comparison reduces to sign-determination on `a + b√5`). Worth revisiting if "jump to an explicit coord of magnitude 10¹⁰⁰" becomes a real feature, rather than a theoretical bound.

## Citation

`lib/pentagrid.ts` declares `Coord = readonly [bigint, bigint, bigint, bigint, bigint]`. The exact `pointToCoord` uses the algebraic constants computed in this script (or a refined cyclotomic-ring version). Any Float64 fast path is render-only and lives behind a viewport-anchor abstraction, citing this writeup as the justification for the anchor scheme.
