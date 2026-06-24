# Penrose — The bridge: substitution → de Bruijn coordinates

Research note. The result that closes the address↔coordinate gap: the substitution
tiling, lifted to ℤ⁵ by edge-integration, is a cut-and-project tiling, so every
substitution-rendered tile gets its exact de Bruijn coordinate. Built and validated
in `research/penrose/cap/bridge.ts` (+ tests).

## The construction

1. Build the tiling by **deflation** (Robinson-triangle substitution from the central
   wheel). This gives vertices and unit edges, reliably, at any depth.
2. Rotate so the edge directions align with the five `ζ^l`. Substitution edges sit at
   `18° + k·36°`; a `−18°` rotation puts them on the `ζ^l` directions.
3. **Integrate the edges.** Each unit edge points along some `ζ^l`, so walking it adds
   `±e_l` to the ℤ⁵ coordinate. BFS from one vertex assigns a ℤ⁵ point to every vertex.

That ℤ⁵ point is the de Bruijn coordinate. Physical position is its projection
`Σ n_l ζ^l`; internal coordinate is `Σ n_l ζ^{2l}`; index is `Σ n_l`.

## The validation (tested)

`bun test ./research/penrose/cap/` — the bridge suite asserts, on a 1211-vertex patch:

- **Every unit edge lies on a `ζ^l` direction** (`badEdges = 0`).
- **The lift is path-independent**: every rhombus closes, zero loop inconsistencies,
  every vertex assigned. (This is the non-trivial part — it means the edge-integration
  is consistent, i.e. the tiling genuinely embeds in ℤ⁵.)
- **Indices obey the de Bruijn index theorem**: exactly four consecutive values
  (here `−2,−1,0,1`, a constant shift of the canonical `{1,2,3,4}`).
- **Internal projections are bounded** (`max |π'| < φ`), the cut-and-project fingerprint.
- **The window is four pentagons** with the `1 : φ : φ : 1` size ratio (outer indices
  small, inner indices large).

So the substitution tiling and the cut-and-project tiling are the **same object**, and
the lift is the explicit substitution-address → de-Bruijn-coordinate map.

## Why this matters

- **The mutual oracle is real.** Two completely independent constructions (substitution
  and cut-and-project) agree, validated by the index theorem and the window. That is the
  cross-family cross-check no prior tool does.
- **It is the open-conjecture case.** Pardo-Guerra, Washburn & Allahyarov
  (arXiv:2603.13553) prove the projection/strip-index side and leave the substitution
  case (Conjecture 5.6 converse) as "the main open problem of this paper." This is an
  explicit, validated construction of exactly that map — the engineering contribution
  the novelty survey flagged.
- **The engine is complete and addressable.** Deflate to render (fast, reliable, both
  directions), lift to address (exact de Bruijn coordinate), all under test.

## Remaining

- **T6: correct face extraction** so the thick:thin = φ ratio test passes from a bare
  vertex set (needed for rendering faces, not for the coordinate map).
- **The base-`A` fold.** The recursive/event-sourced address (digits = per-level child
  offsets, base = the inflation matrix `A`) is the compact form of the same coordinate;
  worth implementing as the navigation representation (small numbers while panning,
  materialize the ℤ⁵ coordinate on demand). The lift here validates the destination; the
  fold would give the cheap route to it.
- **Canonical index normalization.** The lift's indices are shifted by a constant (the
  reference vertex's true index); pin the offset that lands them on `{1,2,3,4}`.

## Files

- `research/penrose/cap/cap.ts` / `cap.test.ts` — cut-and-project engine + inflation `A`.
- `research/penrose/cap/deflate.ts` / `deflate.test.ts` — reliable deflation.
- `research/penrose/cap/bridge.ts` / `bridge.test.ts` — the lift / coordinate map.
