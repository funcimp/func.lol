# Penrose Teaching Spine — editorial arc

**Status:** design (the narrative the `/x/penrose` page tells)
**Date:** 2026-06-25
**Builds on:** `2026-06-24-penrose-v1-design.md` (the v1 design; this refines the teaching
spine into a guided story) and the shipped explorer + Sketch harness.

The `/x/penrose` page is a guided explorable explanation: a single-column scroll that
walks the reader through one question and its consequences, prose alternating with small
playable sketches, ending at the explorer. The goal is to show people how cool this is, in
order, each idea earned by the one before it.

## The arc (sections, in order)

Each section is a short prose beat and, where marked, a sketch (rendered through the
`_components/Sketch.tsx` harness: static, or animated with the reduced-motion contract).

1. **The question.** Can a set of tiles cover the whole infinite plane but only ever
   aperiodically, never settling into a repeating pattern? (Prose.)
2. **The history.** Wang asked whether any set that tiles the plane can do so periodically.
   In 1966 Berger showed no: an aperiodic set exists, his first one used 20,426 Wang tiles.
   It was whittled down over years (Robinson got to 6), until Penrose in 1974 reached just
   **two** tiles plus matching rules. (Prose. Keep it light and accurate; cite names/years,
   no need for a bibliography.)
3. **How the two tiles work.** The fat (72/108) and thin (36/144) rhombi, their matching
   marks, where φ hides. SKETCH: "Meet the two tiles" (built, static + hover).
4. **A local dead-end.** Lay tiles by the local matching rules and you can paint into a
   corner: a spot where the arrows conflict and nothing fits. SKETCH: "The dead-end" (built,
   animated; currently the accessible single-vertex version).
5. **But the problem is deeper.** Here is the real subtlety: you can tile a whole region
   perfectly by local rules and still be globally doomed, and the contradiction is forced
   far from any visible mistake (Penrose's lawn: the bad tile is at the edge, it "goes wrong
   in the middle"). SKETCH (to build, the hard one): grow a valid patch outward ring by ring
   under local rules, center provably fine, until a forced unfillable gap appears in an
   OUTER ring, distant from any choice. The teaching beat: local correctness does not
   guarantee global success, and the failure is non-local.
6. **So you solve it globally.** If local trial-and-error can dead-end, do not tile locally
   at all. Project from a 5-dimensional integer lattice: every tile is a deterministic
   shadow of a 5D point, so the plane is computed, never backtracked, and can never dead-end.
   This is the cut-and-project method, and it is what the explorer runs. SKETCH (to build):
   the cut-and-project view, two linked panels, the physical tiling and the internal
   "shadow" space with the acceptance window; a tile exists iff its 5D shadow lands in the
   window, decided locally from the coordinate, no walk from any origin.
7. **The overlay.** Penrose noticed that overlaying two of these tilings reveals structure:
   slide one over the other and large regions snap into agreement, separated by shifting
   "veins" of interference, all organized by the 5-fold symmetry. SKETCH (to build, the
   projector demo): two tilings, one filled and one as contrasting edges, a slider slides /
   rotates one over the other; agreement islands and the veins between them. Teaching beat:
   any two Penrose tilings share every finite patch yet never globally match.
8. **A coordinate system.** Because every tile is a 5D lattice point, every tile has a
   unique, exact address. That is what lets the explorer tell you where you are anywhere on
   the edgeless plane. SKETCH or prose tied to #6 (the ℤ⁵ address read off the local
   crossing). May merge with #6 if one two-panel sketch carries both the "it exists" and
   the "here is its address" beats.
9. **More magic: scaling.** Any valid Penrose tiling can be inflated or deflated into
   another valid Penrose tiling, scaled by φ, indefinitely; the count of fat to thin tiles
   tends to φ. SKETCHES (to build): "The golden ratio appears" (thick:thin -> φ) and "Zoom
   the hierarchy" (a patch under its φ-supertiling, stepping depths).
10. **The explorer.** A link/hero into `/x/penrose/explore`: walk the addressed, edgeless
    plane, every tile naming itself under your cursor.

## Sketch inventory and status

- Meet the two tiles, static + hover. BUILT.
- The dead-end, animated. BUILT (accessible single-vertex version; section 5 adds the
  faithful far-contradiction beat, either by reworking this or as a second sketch).
- The deeper problem (grow-out to a distant forced gap), animated. TO BUILD.
- Cut-and-project / ℤ⁵ solver (physical + internal window, hover; the address read
  locally), interactive. TO BUILD. (Carries sections 6 and 8.)
- The interference overlay (two tilings, slider, agreement islands + veins), animated. TO
  BUILD.
- The golden ratio appears (thick:thin -> φ), animated. TO BUILD.
- Zoom the hierarchy (φ-supertiling overlay, step depths), animated/slider. TO BUILD.

## Constraints (carried)

- House visual language (DESIGN.md): dark default, paper/ink + `--color-penrose-*` tokens,
  mono labels, no rounded corners on chrome, restrained aesthetic. No emdashes.
- Reduced-motion hard contract: nothing autoplays; under `prefers-reduced-motion` the
  harness renders the representative end state; motion only on user play / slider.
- The sketches that need a tiling use the substitution engine (`deflate`, `subdivide`,
  `colorCounts`) or the pentagrid enumerator; the dead-end and deeper-problem sketches are
  hand-authored (they show local-rule FAILURE, which the global engine never produces).
- Accuracy: the history beat must be factually correct (Berger 1966 / 20,426 tiles;
  Robinson 6; Penrose 1974 / two tiles). Keep it light, not a paper.

## Build order

The page scaffold (the full prose arc with section structure, the two built sketches
slotted, and placeholders for the rest) lands first so the story reads end to end. Then the
sketches fill their slots in arc order, each pushed to the preview for review. The deeper-
problem sketch (section 5) is the hardest and gets its own careful slice.
