# Penrose — The fold: the closed-form address↔coordinate recursion

Research note. The local, O(log) form of the substitution → de-Bruijn-coordinate
map, and the resolution of the additive index correction that was the open piece.
Built and tested in `research/penrose/cap/fold.ts`.

## The result

A persistent vertex's de Bruijn coordinate transforms between consecutive deflation
levels by a single deterministic recursion:

```
coord⁽ᴺ⁺¹⁾ = −A·coord⁽ᴺ⁾ + carry·[1,1,1,1,1]
carry = 1  iff  index(coord⁽ᴺ⁾) is in the upper half of its 4-value band
```

`A` is the integer inflation circulant. This is a **base-(−A) numeration system on
ℤ⁵ with a single binary digit** — and `det A = 2` is exactly why there is one bit.
The digit is the **de Bruijn index carry**: `A`'s eigenvalue on the index direction
is 2, so the index would double out of range; the all-ones vector (a +5 to the index)
pulls it back. That conditional all-ones vector is the additive index correction the
literature leaves unstated.

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
- **Canonical index band.** `bandMin` here comes from the lift's reference vertex; pin
  the offset that fixes the band to the canonical `{1,2,3,4}` so `carry` is absolute.
- **T6: face extraction** (for rendering rhombi and the thick:thin = φ proof).

## The full tested chain

`research/penrose/cap/`: `cap` (cut-and-project engine + inflation `A`), `deflate`
(reliable deflation), `bridge` (substitution → ℤ⁵ via edge-integration), `fold` (the
closed-form recursion). `bun test ./research/penrose/cap/` — 24 pass, 1 todo.
