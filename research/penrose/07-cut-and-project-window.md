# Penrose — The exact cut-and-project window, and the validated engine

Research note. Records the exact acceptance window (from the literature), the
inflation/offset rule, a validated cut-and-project engine built from them, and the
two pieces that remain genuinely open (which are our contribution). This is the
technical foundation for the Z⁵ substitution alphabet and the address↔coordinate
bridge.

## The exact window (found, two independent formalisms agree)

The Penrose vertex set is `V = { n ∈ ℤ⁵ : π'(n) ∈ K_{σ(n)} }`, where:

- `σ(n) = Σ n_l` is the **index**, and only `σ ∈ {1,2,3,4}` carry vertices.
- `π(n) = Σ n_l ζ^l` is the **physical** projection (`ζ = e^{2πi/5}`), the vertex
  position in the plane.
- `π'(n) = Σ n_l ζ^{2l}` is the **internal** projection (the star map `ζ → ζ²`).
- The four windows, with `P` = the unit regular pentagon (convex hull of the five
  5th-roots of unity) and `τ = φ`:

  | index `n` | window `K_n` | shape |
  | --- | --- | --- |
  | 1 | `v + P` | small, upright |
  | 2 | `v − τP` | large, reversed |
  | 3 | `v + τP` | large, upright |
  | 4 | `v − P` | small, reversed |

  Circumradius ratio `1 : τ : τ : 1`; scaling signs `(+1, −τ, +τ, −1)`; `K₁,K₃`
  share orientation, `K₂,K₄` are point-reversed. `v ∈ E'` is the offset (de Bruijn's
  γ data; `v = 0` is the singular symmetric center, so use a generic `v`).

Sources: Cotfas math-ph/0403062 (before eq.21) and 0710.3845 (after eq.9);
cyclotomic form Haynes-Lutsko arXiv:2512.21444 Ex.7.11 / Baake-Grimm. The two agree
on shapes, scalings, orientations, and index assignment.

### Validated

Filtering ℤ⁵ through these four pentagons (generic `v`) produces a correct Penrose
rhombus tiling: in a disk of radius 6, 136 vertices, 245 unit-distance edges, **every
edge on one of the five `ζ^l` directions** (zero off-direction), internal projections
bounded, vertex-by-index counts `{1:23, 2:44, 3:49, 4:20}` matching the `1:τ:τ:1`
size ratio. So we have a clean, exact, validated cut-and-project engine.

## Inflation and the offset (γ) transform

- The φ-inflation is the integer circulant `A` (first row `0,0,1,1,0`), which **is**
  Cotfas's operator `S` for `λ = −τ`. Eigenvalues, verified numerically: `−φ`
  (physical `E`), `1/φ` (internal `E'`), `2` (diagonal/index `E''`).
- Internal contraction about a center `y`: `π'[S(x−y)+y] = (1/φ)·(π'x − π'y) + π'y`.
- **Offset (γ) transform, affine form (usable now):** the offset flows as
  `offset → v + (1/φ)·(offset − v)`, contracting toward the fixed internal center
  `v` by `1/φ`. `Σγ_l ∈ ℤ` is invariant; the index multiplies `n → 2n`. Window
  nesting holds because `|1/φ| < 1` keeps the contracted pentagon inside.
- We work in ℤ⁵ + window directly, so the affine offset rule is all the engine
  needs. The *literal closed-form pentagrid recurrence* `γ_l → γ_l'` is not published
  openly (it would be in D'Andrea 2023 §5.3, paywalled, or de Bruijn 1990); we would
  derive it only if we want to emit de-Bruijn-γ coordinates rather than ℤ⁵ points.

de Bruijn 5-tuple emission (the projection side, fully explicit):
`K_j(z) = ⌈Re(z·ζ^{-j}) + γ_j⌉`, `Σγ_j = 0`, index `Σ K_j ∈ {1,2,3,4}`, vertex
`f(z) = Σ K_j ζ^j` (Au-Yang & Perk eqs. 24-26).

## What remains open (our contribution)

The literature is explicit that two pieces are unsettled, and they are exactly what
we need:

1. **The Z⁵ substitution alphabet = the window IFS displacement set.** Each pentagon
   deflates as `Ω_i = ⋃_j ⋃_{t ∈ T_ij} (λ*·Ω_j + t*)` with `λ* = −1/φ` (Baake-Grimm
   arXiv:2004.03256 eq.7; the Fibonacci template `W_a = σW_a ∪ σW_b`,
   `W_b = σW_a + σ`, `σ = −1/φ`). The displacement shifts `t` for Penrose are **not
   given in closed form** in any source found. Deriving them (and lifting to ℤ⁵) is
   the substitution alphabet.

2. **The address → de Bruijn 5-tuple map.** Pardo-Guerra, Washburn & Allahyarov
   (arXiv:2603.13553) prove the strip-index/height side and state the substitution
   converse (Conjecture 5.6) as **"the main open problem of this paper."** The map
   must be assembled as: hierarchy address → displacement (inflation matrix `T`) →
   ℤ⁵ lift → `K` via the ⌈·⌉ formula. No citable closed form exists.

Both are now tractable on the validated cut-and-project engine: the window IFS shifts
can be fit geometrically against the exact pentagons, and the address map composed
through `A` and the window test.

## Citations

- N. Cotfas, "On the self-similarities of the Penrose tiling", arXiv:math-ph/0403062
  (J. Phys. A 37 (2004) 3125). Window, projectors, inflation integrality.
- N. Cotfas, "Symmetry properties of Penrose type tilings", arXiv:0710.3845. Window
  `W2=−τW1, W3=τW1, W4=−W1`; offset transform.
- A. Haynes & C. Lutsko, "The Gauss circle problem for Penrose tilings",
  arXiv:2512.21444. Cyclotomic window `P, −τP−2, τP−3, −P−4`.
- M. Baake & U. Grimm, "Inflation versus projection sets… the role of the window",
  arXiv:2004.03256. Window IFS, `σ = −1/φ`.
- Au-Yang & Perk, arXiv:1306.6698. de Bruijn 5-tuple `K_j = ⌈Re(z ζ^{-j}) + γ_j⌉`.
- Pardo-Guerra, Washburn & Allahyarov, arXiv:2603.13553. The substitution
  address↔coordinate map as the stated open problem (Conjecture 5.6).
- F. D'Andrea, "A Guide to Penrose Tilings", Springer 2023, §5.3 (paywalled): the
  likely home of the explicit γ recurrence.
- de Bruijn, "Updown generation of Penrose patterns", Indag. Math. N.S. 1 (1990)
  201-220 (not openly retrievable): the explicit inflation rule.
