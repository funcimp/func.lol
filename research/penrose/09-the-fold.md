# Penrose — The fold: the closed-form address↔coordinate recursion

Research note. The local, O(log) form of the substitution → de-Bruijn-coordinate
map, and the resolution of the additive index correction that was the open piece.
Built and tested in `research/penrose/cap/fold.ts`.

## The result

A persistent vertex's de Bruijn coordinate transforms between consecutive deflation
levels by a single deterministic recursion:

```
coord' = −A·coord + m·[1,1,1,1,1]
m = ⌈(1 + 2·index)/5⌉        (canonical frame, index ∈ {1,2,3,4} ⇒ m ∈ {1,2})
```

(Frame-relative form, for a band starting at `bandMin`: `m = ⌈(bandMin + 2·index)/5⌉`.)

Nothing here is fitted — every term is forced:

- **`−A`** is the inflation operator (eigenvalues `−φ, 1/φ, 2`).
- **`[1,1,1,1,1]` is forced, not chosen.** It is `A`'s eigenvector for eigenvalue 2
  (`A·𝟙 = 2𝟙`), and it is the **kernel of both projections**: `π(𝟙) = π'(𝟙) = 0`
  (the five 5th-roots of unity sum to zero). So adding it shifts the de Bruijn index
  by exactly 5 and moves the tile not at all. It is the *unique* index-gauge
  direction, and `det A = 2` is why a single such digit suffices.
- **`m` is the forced carry.** `index' = −2·index + 5m`, and `m` is the only integer
  putting `index'` back in `{1,2,3,4}`. Since `−2` is invertible mod 5,
  `index' = (−2·index) mod 5` permutes `{1,2,3,4}` bijectively (`1→3→4→2→1`).

This is a base-`(−A)` numeration on ℤ⁵; the digit is the de Bruijn index carry —
the additive index correction the literature leaves unstated.

(History: a first version keyed the carry off the *source* band and held at only two
of four level pairs — a frame coincidence. Keying it off the target/canonical index
makes it universal; it now holds at every level pair under test.)

## Why it matters

- **Closed-form and local.** No global edge-integration; one matrix-multiply plus a
  conditional add per level. Iterating from a coarse seed reaches any depth in
  O(levels) = O(log distance) exact-integer steps. This is the efficient address↔
  coordinate transform the navigation model needs (small numbers while zooming,
  materialize the full coordinate on demand).
- **Resolves the open piece.** The substitution-address → coordinate map was the
  cocycle paper's stated open problem; its hard part is precisely the additive index
  correction, now pinned to one bit.
- **Validated against an independent oracle.** The recursion reproduces every
  persistent vertex of the edge-integration lift exactly (100%), and stays exact at
  any depth. Two independent routes to the coordinate agree.

## How it was found

Lift two consecutive deflation levels (the edge-integration bridge), match persistent
vertices by wheel position, and fit `coord⁽ᴺ⁺¹⁾ = M·coord⁽ᴺ⁾ + shift`. `M = −A` fits
exactly half the vertices; the residual takes exactly two values, `0` and
`[1,1,1,1,1]`, and the choice is fully determined by `index(coord⁽ᴺ⁾)` (lower band →
0, upper band → carry). That is the recursion.

## Remaining to complete the full map

- **The golden-point (new-vertex) rule.** The recursion above transforms a *persistent*
  vertex between scales. Deflation also creates new vertices (the golden-section points
  on each edge); their ℤ⁵ offset is one finer-lattice edge (`±e_l`), sketched but not
  yet formalized/tested. The recursion + this rule give the complete tile-enumeration
  with coordinates.
- **T6: face extraction** (for rendering rhombi and the thick:thin = φ proof).

## The full tested chain

`research/penrose/cap/`: `cap` (cut-and-project engine + inflation `A`), `deflate`
(reliable deflation), `bridge` (substitution → ℤ⁵ via edge-integration), `fold` (the
closed-form recursion). `bun test ./research/penrose/cap/` — 24 pass, 1 todo.
