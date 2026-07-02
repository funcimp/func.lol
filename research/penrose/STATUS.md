# Penrose research — status: verified vs open

A living summary of where the cut-and-project / substitution engine and the
address↔coordinate work stand. Separates what is **proven (by runnable test)** from
what is **still open**. The numbered notes (`05`–`09`) carry the detail; the tested
code is in `research/penrose/cap/`.

Run the proofs: `bun test ./research/penrose/cap/` → **34 pass, 0 fail**.

## Verified (tested)

- **The exact acceptance window** is the four pentagons `K₁=P, K₂=−τP, K₃=τP, K₄=−P`
  by index `Σn ∈ {1,2,3,4}` (Cotfas; two formalisms agree). Filtering ℤ⁵ through it
  generates a correct Penrose tiling — every unit edge on a `ζˡ` direction, internal
  projections bounded. (`cap.ts`, `07`.)
- **Inflation `A` is exactly the φ-inflation** — physical `×(−φ)`, internal `×(1/φ)`,
  index `×2`, to 9 decimals. `A` is Cotfas's operator. (`cap.ts`.)
- **Deflation is reliable at every level** — the substitution gives a valid Penrose
  tiling at each depth: color ratio → φ, tiles isoceles, exact `×1/φ` contraction,
  count `×φ²`, deterministic. (`deflate.ts`, `05`.) So both directions hold.
- **The bridge**: the substitution tiling lifts to ℤ⁵ by edge-integration; the lift
  is path-independent (rhombi close), the indices obey the de Bruijn index theorem
  (4 consecutive values), and the internal projections fill the four-pentagon window.
  The two independent constructions are the same object, and every substitution tile
  gets its de Bruijn coordinate. (`bridge.ts`, `08`.)
- **The closed-form coordinate recursion** `coord' = −A·coord + m·[1,1,1,1,1]`, with
  `m = ⌈(1+2·index)/5⌉` forced by the index landing in `{1,2,3,4}`. `[1,1,1,1,1]` is
  forced: `A`'s eigenvalue-2 eigenvector and the kernel of both projections (the
  unique index gauge). Holds at every level pair (3→4 … 6→7), not a fit. (`fold.ts`,
  `09`.)
- **Face extraction is exact.** A 2-face `[n;j,k]` is a tile iff all four corners are
  accepted vertices — validated tile-for-tile against the substitution (no phantoms,
  none missing, types agree, thick:thin → φ). (`faces.ts`.)
- **The golden-point rule completes coordinate-space deflation.** A deflation-created
  vertex on edge `(A,B)` in direction `l` is exactly `goldenPoint(A,l) = fold(A) + eₗ`,
  proven against the lift. So deflation runs entirely in ℤ⁵: existing vertices by the
  fold, new vertices by `fold(A)+eₗ`, faces by corner-acceptance. (`fold.ts`.)

What this amounts to: a **tested reimplementation of classical de Bruijn theory**. The
engine reproduces, by runnable test, results that are standard in the literature —
de Bruijn 1981 (pentagrid + window), de Bruijn 1990 (updown / composition recurrence),
and D'Andrea 2023 (the modern textbook proofs). It is local, O(log)-per-tile, exact
integer. It is **not novel mathematics.** See "Provenance" below for the line-by-line
correspondence. The value is engineering and verification: a correct, test-backed
substitution-address → de-Bruijn-coordinate map we can build the explorer on.

## Open / unsolved (still working on)

### Math / the map
- **Self-contained canonical frame.** The fold currently reads the target band's min
  from the lift. A fully self-contained absolute frame (solve the reference vertex's
  de Bruijn coordinate once, so the band is always `{1,2,3,4}` without a lift) would
  remove the dependency. The rule itself is forced and universal; this is bookkeeping.
- **Address-as-path → coordinate, composed.** The digit *sequence* (hierarchy path) is
  D'Andrea's **index sequence** `ι(T,z₀) ∈ {0,1}^ℕ` (§3.4, Def 3.24): 0 = large
  triangle, 1 = gnomon, at each composition level. Known and classified (Prop 3.27:
  tilings/isometry → sequences/tail-equivalence is 2-to-1; Lemma 3.26: no two
  consecutive 1s = the golden-mean shift, which is *why* color-ratio → φ). It pins the
  tiling only up to isometry — it forgets the absolute frame. The one thing we add is
  anchoring that path to an absolute ℤ⁵ coordinate via the fold. That is wiring two
  known constructions together, not new math. Worth formalizing for O(log) addressing.

### Literature: retrieved, verdict in
- **de Bruijn 1990 "Updown generation"** and **D'Andrea 2023 §5.3 "Composition and
  Pentagrids"** are now read. Verdict: our closed form does **not** extend theirs — it
  *is* theirs. D'Andrea **Theorem 5.16** is our fold exactly (`coord' = −A·coord +
  m·ones` = Φ via the cyclotomic identity `C = J − A` and `m = index − c`; the carry
  `{0,1,1,2}` we re-derived is Theorem 5.16's carry). Details in Provenance below.

### Rendering / engineering
- **BigInt deep-zoom path.** The recursion is exact integer; wiring it to BigInt for
  unbounded distance (and the pruned-deflation viewport generation) is unbuilt.

### Downstream (not math-open)
- **Explorer integration**: wire this engine into `/x/penrose` (the v1 we started
  from), replacing the buggy viewport-anchor. Spec rewritten around the cut-and-project /
  substitution engine: `docs/superpowers/specs/2026-06-24-penrose-v1-design.md` (bounded
  explorer first, then the teaching spine; infinite pan is v2). The old
  `2026-06-23-penrose-v1-design.md` is superseded.
- **Writeup**: a teaching note, not a paper. The math is classical (de Bruijn,
  D'Andrea); the writeup's job is to explain it well and to document that our engine
  reproduces it under test. No novelty claim.

## Provenance / citations

Every result below is classical. The right-hand column is the primary source; the
left is where we reproduce it under test.

- **The four-pentagon window by index** (`cap.ts`, `07`) — de Bruijn 1981 §8; Cotfas;
  D'Andrea 2023 **Prop 5.15** (`P₂=−φP₁, P₃=φP₁, P₄=−P₁`, = our `SCALE_BY_INDEX`).
- **Inflation `A`, eigenvalues −φ / 1/φ / 2** (`cap.ts`) — Cotfas's operator; the
  composition matrix `C = I+S+S⁻¹` of D'Andrea **Thm 5.16** is `J − A`.
- **The closed-form fold** `coord' = −A·coord + m·ones`, `m = ⌈(1+2·index)/5⌉`
  (`fold.ts`, `09`) — D'Andrea 2023 **Theorem 5.16** (composition map Φ), equivalently
  de Bruijn 1990 §3.12. The carry `m = index − c`, `c ∈ {0,1,1,2}`, is Thm 5.16's `c`.
- **The bridge** (substitution lifts to ℤ⁵; index theorem; bounded internal)
  (`bridge.ts`, `08`) — de Bruijn 1981/1990; D'Andrea 2023 **§5.3** (Prop 5.14, the
  cut-and-project characterization `f_γ(n̄) ∈ Im(g)`).
- **Deflation / color ratio → φ** (`deflate.ts`, `05`) — Robinson substitution;
  D'Andrea 2023 **§3.4** Lemma 3.26 (golden-mean shift) + **§3.5** (density).
- **Index sequence = the hierarchy path** — D'Andrea 2023 **§3.4** Def 3.24,
  Prop 3.27 (2-to-1 onto tail-equivalence classes). The doorway to Ch 6 (Connes'
  noncommutative space), which we did **not** touch.
- **Terminology**: two distinct "index" objects. de Bruijn pentagrid index
  `σ = Σn_l ∈ {1,2,3,4}` (Ch 5, our `index()`) vs Robinson index *sequence*
  `ι(T,z₀)` (Ch 3, the path). Do not conflate.

Full citations:
- N.G. de Bruijn, "Algebraic theory of Penrose's non-periodic tilings of the plane,
  I & II," Indag. Math. 43 (1981), 39–66.
- N.G. de Bruijn, "Updown generation of Penrose patterns," Indag. Math. 1 (1990),
  201–219.
- F. D'Andrea, *A Guide to Penrose Tilings*, Springer (2023). Ch 3 (Robinson
  triangles, index sequences), Ch 5 (pentagrids, composition), Ch 6 (noncommutative
  space).

On arXiv:2603.13553 (Pardo-Guerra/Washburn/Allahyarov): we do **not** claim to settle
their open problem. Their conjecture is broader (cohomological/general). We have a
tested map for the substitution case, which is exactly the classical de Bruijn theory
above — not a proof of their general statement.

## Corrections on the record (for honesty)
- The de Bruijn viewport-anchor in the original explorer does **not** preserve the
  tiling across a re-anchor (any nonzero shift) — a real bug; the engine was replaced,
  not patched. (`05`.)
- The first version of the fold's carry keyed off the *source* band and held at only
  two of four level pairs — a frame coincidence caught by a skeptical re-check. The
  forced target/canonical rule is universal. (`09`.)
- Earlier drafts framed the fold and bridge as a "narrow, publishable contribution on
  an open frontier." That was wrong. Reading de Bruijn 1990 and D'Andrea 2023 (esp.
  Thm 5.16) showed the results are classical and standard. The framing is corrected
  throughout: a tested reimplementation, not new mathematics.

## Map of the work
- Notes: `05`-substitution-and-z5, `06`-addressing-and-applications, `07`-cut-and-
  project-window, `08`-the-bridge, `09`-the-fold.
- Code: `cap/{cap,deflate,bridge,fold,faces}.ts` (+ `.test.ts`). 34 tests pass.
- Tasks #6 (face extraction) and #7 (golden-point rule) are now done; the math/engine
  is complete and tested. What remains is bookkeeping (canonical frame, path
  composition) and engineering (BigInt deep-zoom, explorer integration, the writeup).
