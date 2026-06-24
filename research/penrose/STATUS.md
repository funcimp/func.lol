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

What this amounts to: an explicit, validated **substitution-address → de-Bruijn-
coordinate map**, the case Pardo-Guerra/Washburn/Allahyarov (arXiv:2603.13553) leave
as their main open problem. Local, O(log)-per-tile, exact integer.

## Open / unsolved (still working on)

### Math / the map
- **Self-contained canonical frame.** The fold currently reads the target band's min
  from the lift. A fully self-contained absolute frame (solve the reference vertex's
  de Bruijn coordinate once, so the band is always `{1,2,3,4}` without a lift) would
  remove the dependency. The rule itself is forced and universal; this is bookkeeping.
- **Address-as-path → coordinate, composed.** We have the per-level recursion; the
  complete O(log) addressing also wants the digit *sequence* (the hierarchy path)
  formalized so a far tile's coordinate is read off its path directly. Partially in
  hand (the recursion is the per-level step).
- **Relation to the closed conjecture.** We have an explicit, validated *construction*
  for the substitution case. Whether it constitutes a *proof* of the general
  conjecture (every conservation-forced tiling is a Pisot CPT) is a broader claim we
  do **not** make. Honest scope: a validated explicit map, not a theorem.

### Literature we could not retrieve
- de Bruijn 1990 "Updown generation" (the explicit `γ_l` pentagrid recurrence) and
  D'Andrea 2023 §5.3 "Composition and pentagrids" are paywalled/unextracted. Worth
  obtaining to check whether our closed form matches or extends theirs. (User offered
  to source paywalled material.)

### Rendering / engineering
- **BigInt deep-zoom path.** The recursion is exact integer; wiring it to BigInt for
  unbounded distance (and the pruned-deflation viewport generation) is unbuilt.

### Downstream (not math-open)
- **Explorer integration**: wire this engine into `/x/penrose` (the v1 we started
  from), replacing the buggy viewport-anchor. The v1 spec
  (`docs/superpowers/specs/2026-06-23-penrose-v1-design.md`) predates this pivot and
  needs a rewrite around the cut-and-project / substitution engine.
- **Writeup / paper**: the bridge + the forced index-carry recursion is a genuine,
  narrow, publishable contribution on an explicitly-open frontier.

## Corrections on the record (for honesty)
- The de Bruijn viewport-anchor in the original explorer does **not** preserve the
  tiling across a re-anchor (any nonzero shift) — a real bug; the engine was replaced,
  not patched. (`05`.)
- The first version of the fold's carry keyed off the *source* band and held at only
  two of four level pairs — a frame coincidence caught by a skeptical re-check. The
  forced target/canonical rule is universal. (`09`.)

## Map of the work
- Notes: `05`-substitution-and-z5, `06`-addressing-and-applications, `07`-cut-and-
  project-window, `08`-the-bridge, `09`-the-fold.
- Code: `cap/{cap,deflate,bridge,fold,faces}.ts` (+ `.test.ts`). 34 tests pass.
- Tasks #6 (face extraction) and #7 (golden-point rule) are now done; the math/engine
  is complete and tested. What remains is bookkeeping (canonical frame, path
  composition) and engineering (BigInt deep-zoom, explorer integration, the writeup).
