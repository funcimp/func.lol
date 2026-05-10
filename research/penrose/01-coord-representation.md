# 01 — Coord representation

**Question.** Float64 vs BigInt for the pentagrid `Coord` 5-tuple.

**Decision.** Ship `Coord = readonly [number, number, number, number, number]`. No BigInt, no viewport-anchor pattern.

## Method

For each world-position magnitude R, sample 10,000 random points at radius R. Displace each by δ = 1e-3 (a sub-tile step well above Float64 ULP across the reachable range) in a random direction. Classify the coord change:

- `quantized` — Float64 ate the displacement (`p+δ === p` at the float level).
- `stable` — coord unchanged.
- `adjacent` — coord differs by at most 1 in every index. Expected near a tile boundary at any R.
- `jump` — coord differs by >1 in some index. The precision-failure signal.

[`01-coord-representation.ts`](./01-coord-representation.ts), seed `funclol`.

## Numbers

```
|p|       quantized  stable  adjacent  jump
0         0.0%       100.0%  0.0%      0.00%
1e+2      0.0%       99.8%   0.2%      0.00%
1e+4      0.0%       99.6%   0.4%      0.00%
1e+6      0.0%       99.7%   0.3%      0.00%
1e+8      0.0%       99.6%   0.4%      0.00%
1e+9      0.0%       99.7%   0.3%      0.00%
1e+10     0.0%       99.7%   0.3%      0.00%
1e+11     0.0%       99.6%   0.4%      0.00%
1e+12     0.0%       99.7%   0.4%      0.00%
1e+14     89.9%      10.1%   0.1%      0.00%
1e+16     99.9%      0.1%    0.0%      0.00%
```

## Interpretation

- Zero jumps anywhere in the tested range. Float64 holds.
- Quantization first appears at |p|=1e14 (ULP ≈ 0.022, exceeds δ for most points). The explorer is six orders of magnitude clear of this.
- Steady ~0.3-0.4% adjacent rate across the safe range is the expected base rate of points landing within δ of a tile boundary (5 directions × 2δ × line density ≈ 0.4%).

## Reach estimate

At zoom `z` in a 1500px viewport, sustained panning at one screen-width per second moves world position by `1500/z` per second. One continuous hour of panning:

| zoom | reach     |
| ---- | --------- |
| 1    | \|p\| ≈ 5e6 |
| 10   | \|p\| ≈ 5e5 |
| 1000 | \|p\| ≈ 5e3 |

Worst case is six orders of magnitude under the first observed precision artifact.

## Citation

The shipped `lib/pentagrid.ts` declares `Coord = readonly [number, number, number, number, number]` and cites this file in a one-line comment.

If a future feature lets the user paste an arbitrary coord and jump to it (allowing |p| ≫ 1e10), revisit.
