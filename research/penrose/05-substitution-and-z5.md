# Penrose — Substitution, Z⁵ coordinates, and the engine pivot

Research note. Captures the investigation that moved the explorer's engine from
"de Bruijn pentagrid + BigInt viewport anchor" to "substitution / deflation with
exact arithmetic, addressed by de Bruijn Z⁵ coordinates." Includes the literature
survey, what is established versus what we must derive, the novelty assessment, and
the open leads.

Status: design research, not yet implemented. The shipped engine still uses the
older approach; this note is the basis for the rewrite.

## How we got here

1. **The re-anchor bug.** The shipped explorer uses a BigInt anchor with a Float64
   render offset, re-anchoring when the offset passes `1e8`. Probing showed the
   re-anchor does **not preserve the tiling**: enumerating the same world region
   from two different anchors yields different tiles, at *any* nonzero shift (not a
   precision effect). The de Bruijn *addressing* (`pointToCoordExact` /
   `pointToCoordAnchored`) is correct and anchor-independent; only the tile
   *generation* geometry in `enumerateTiles` drifts. So the coordinate system was
   never the broken part; the renderer was.

2. **Substitution is correct and traverses cheaply.** A Robinson-triangle
   deflation (Preshing's formulation) produces a correct P3 tiling (thick:thin → φ,
   exact edge ratios). With viewport pruning, reaching a far viewport costs work
   that grows only with the *number of inflation levels* (`~log_φ(distance)`), a
   few hundred tiles per level, versus exponential blow-up without pruning
   (`1.6e10` triangles → `~880` of real work at radius `1e4`).

3. **BigInt is fast enough; Float64 is not precise enough.** Benchmarking pruned
   deflation in Float64 vs fixed-point BigInt:

   | distance D | Float64 | clean? | BigInt | clean? | slowdown |
   | --- | --- | --- | --- | --- | --- |
   | 1e12 | 0.02 ms | yes | 0.20 ms | yes | ~10× |
   | 1e15 | 0.03 ms | **no** | 0.32 ms | yes | ~9× |
   | 1e50 | — | — | 0.62 ms | yes | — |

   Float64 dies near `1e13` (relative precision erodes with magnitude). Fixed-point
   BigInt has *constant absolute* precision, so it stays clean at any distance, at
   sub-millisecond cost (well under a 16 ms frame). The research-03 "BigInt is 29 ms,
   too slow" result measured full per-tile lattice enumeration; pruning cuts the
   BigInt work ~50×.

4. **The two constructions are the same tiling family.** The substitution "sun" and
   de Bruijn tilings share radial vertex signatures exactly (same local-isomorphism
   class). Radial matching cannot pin the *exact* γ (the whole LI class shares it),
   which sent us to the literature.

## Literature survey

Primary sources and what they establish. Where a claim is our synthesis rather than
a verbatim source, it is marked.

### The pentagrid and its coordinate

- de Bruijn (1981) maps `x ∈ ℝ²` to a 5-tuple `K_j(x) = ⌈x·v_j + γ_j⌉`, with
  `v_j = (cos 2πj/5, sin 2πj/5)` and `γ_j` real **offsets** (perpendicular line
  displacements, not spacings). The dual is a Penrose P3 tiling iff `Σγ_j ∈ ℤ`
  (canonically `Σγ_j = 0`).
- The vertex index `Index(z) = Σ_j K_j(z)` takes only the values `{1,2,3,4}`
  (Au-Yang & Perk, attributed to de Bruijn). Even `{2,4}` / odd `{1,3}` sublattices.
- Vertex position map: `f(z) = Σ_j K_j(z) · ζ^j`, `ζ = e^{2πi/5}`. **The 5-tuple is
  the Z⁵ cut-and-project coordinate, and the physical position is its projection.**
- **Multigrid = projection** (Gähler & Rhyner 1986, proven): the grid method and the
  projection-from-Z⁵ method are equivalent with an explicit offset↔window map.

### The symmetric center (sun / star)

- The unique `D₅`-symmetric pentagrid is `γ = (0,0,0,0,0)`, and it is **singular**:
  five lines meet at the origin, whose dual is a central regular **decagon**.
- The **sun** and **star** are the two `D₅`-symmetric desingularizations of that
  decagon, *not* two distinct nonzero offset vectors. (Sourced synthesis from the
  singular-pentagrid result; de Bruijn's own "sun/star" text is a scanned image we
  could not extract, and D'Andrea 2023 §3.1.2 is paywalled.)
- **Watch out:** Greg Egan's applet uses a different convention where the offset is
  the *window center*; there `a=(1/5,…,1/5)` gives 5-fold symmetry. That `1/5` is
  **not** de Bruijn's `γ`. Do not transplant it into `⌈x·v_j + γ_j⌉`.
- LI class is fixed by `Σγ_j mod 1`. `Σγ_j ∈ ℤ` is Penrose; `Σγ_j = 1/2` is the
  distinct "anti-Penrose" ten-fold class.
- **Decision:** the explorer should render a **generic regular** tiling
  (`Σγ_j ∈ ℤ`, offset off the singular center) to avoid the decagon and keep
  coordinates clean everywhere.

### Inflation as an integer map on Z⁵

- φ-inflation is the single integer circulant `A` on Z⁵ with first row
  `(0,0,1,1,0)`. Eigenvalues: `−φ` on the physical plane (`ζ^j`), `1/φ` on the
  internal plane (`ζ^{2j}`, the Galois conjugate `ζ → ζ²`), and `2` on the all-ones
  diagonal (the index direction). Integer, maps Z⁵ → Z⁵. (Cotfas
  math-ph/0403062; eigenstructure independently reproduced in the survey.)
- The offset transforms as the single internal-space phase
  `Σ_j γ_j ζ^{2j}`, contracted by `1/φ` per inflation step. `Σγ_j = 0` (zero
  diagonal component) is preserved because `A` is `C₅`-equivariant.
- The exact per-offset `γ_j → γ'_j` with its additive constant lives in de Bruijn
  1990 "Updown generation" (paywalled). We have the verified linear-algebra form and
  would derive the offset form ourselves.

### Pruned deflation and exact arithmetic (prior art)

- Simon Tatham's quasiblog does pruned deflation to a target region with exact
  `Z[ζ₁₀]` / `a + b√5` vertex arithmetic. This is the closest prior art for the
  renderer pillar; our renderer extends it to BigInt for unbounded deep zoom.
- Tatham (arXiv:2512.16595) formalizes the substitution-hierarchy address as
  finite-state transducers, explicitly **non-geometric** ("position not required").

## The architecture: work in Z⁵

The literature collapses the "two engines" idea into one representation.

- **Every tile/vertex is a Z⁵ lattice point** `n = (n_0,…,n_4)`.
- **Geometry** = projection `Σ n_j ζ^j` (for rendering), exact in `Z[ζ]`/BigInt.
- **Address** = the Z⁵ point itself (the de Bruijn coordinate), with index
  `Σ n_j ∈ {1,2,3,4}`. The coordinate is not something bolted on; it *is* the
  representation.
- **Inflation/deflation** = the integer matrix `A` (and the substitution rule for
  the fine direction). Exact, unbounded, no float drift.
- **Cross-validation** = an independent pentagrid enumeration (a genuinely different
  algorithm) as a mutual oracle. The regression framework survives.

This keeps the coordinate system, gives exact geometry at any zoom, uses one exact
integer substrate, and unifies with the inflation teaching demo.

## Novelty (is there a paper?)

Honest read: each pillar has prior art; the specific combination appears unpublished.

- **Prior art:** pruned deflation + exact arithmetic (Tatham); de Bruijn coordinate
  addressing (classical); "two constructions as oracle" (gglouser, but only
  projection-vs-multigrid, same family, no deep zoom).
- **What would be new:**
  1. **Substitution vs pentagrid as a *cross-family* mutual oracle** (existing tools
     only cross-check within the projection family).
  2. **An explicit address↔de-Bruijn-coordinate bridge for the substitution case**,
     which Pardo-Guerra, Washburn & Allahyarov (arXiv:2603.13553, 2026) prove for
     height-functions/strip-indices but leave as an **open conjecture** for
     substitution. An explicit, validated construction lands on that frontier.
  3. **BigInt arbitrary-precision deflation for unbounded deep zoom** — no public
     implementation found (existing renderers are float, or exact-field but not
     deep-zoom).

The strongest publishable claim is not "we render Penrose tilings" (well-trodden) but
"an explicit, validated address↔de-Bruijn-coordinate correspondence realized as a
mutual-oracle deep-zoom renderer." A systems contribution that touches an open math
conjecture, not a pure-math breakthrough. Caveat: negative result over ~10 searches; a
niche source could exist.

## Open leads / what we must derive

- **Get D'Andrea 2023 §5.3 "Composition and pentagrids" and §3.4 "Index sequences"**
  (Springer; arXiv preview is front-matter only). The single most important source
  to obtain before claiming the address↔coordinate map is unpublished; it may already
  contain a partial version.
- **The Z⁵ substitution (deflation) rule.** `A` gives inflation (fine → coarse);
  deflation adds child Z⁵ points by specific displacement vectors we must derive
  from the substitution geometry. This is the constructive core.
- **The exact `γ_j → γ'_j` offset inflation constant** (de Bruijn 1990, paywalled).
  We have the linear-algebra form; derive the additive constant in grid coordinates.
- **Per-tile window resolution:** which of the four pentagonal windows a tile at a
  given hierarchy address lands in. Established at the LI-class/index level only.
- **A BigInt deep-zoom renderer** for unbounded distance: unproven engineering we
  build ourselves.

## Citations

- N. G. de Bruijn, "Algebraic theory of Penrose's non-periodic tilings of the plane,
  I and II", Indag. Math. 43 (1981) 39-66.
  <https://pure.tue.nl/ws/files/4344195/597566.pdf>
- N. G. de Bruijn, "Updown generation of Penrose patterns", Indag. Math. N.S. 1
  (1990) 201-220. <https://www.sciencedirect.com/science/article/pii/0019357790900058>
- F. Gähler & J. Rhyner, "Equivalence of the generalised grid and projection
  methods…", J. Phys. A 19 (1986) 267-277.
- H. Au-Yang & J. H. H. Perk, "Quasicrystals — The impact of N. G. de Bruijn",
  arXiv:1306.6698 (2013). <https://arxiv.org/pdf/1306.6698>
- L. Effinger-Dean, "The Empire Problem in Penrose Tilings" (Williams thesis, 2006),
  Ch. 4. <https://www.cs.williams.edu/~bailey/06le.pdf>
- N. Cotfas, "On the self-similarities of the Penrose tiling", arXiv:math-ph/0403062
  (2004). <https://arxiv.org/pdf/math-ph/0403062>
- S. Pardo-Guerra, J. Washburn & E. Allahyarov, "Matching Rules as Cocycle
  Conditions…", arXiv:2603.13553 (2026). <https://arxiv.org/pdf/2603.13553> — leaves
  the substitution address↔coordinate map as an open conjecture.
- S. Tatham, "Two algorithms for randomly generating aperiodic tilings".
  <https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/aperiodic-tilings/>
- C. Goodman-Strauss, "Matching rules and substitution tilings", Ann. Math. 147
  (1998) 181-223.
- F. D'Andrea, "A Guide to Penrose Tilings", Springer 2023 (arXiv:2310.18950
  front-matter). <https://arxiv.org/pdf/2310.18950>
