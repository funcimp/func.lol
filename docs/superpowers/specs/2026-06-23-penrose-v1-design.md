# Penrose — v1 Design

> **SUPERSEDED (2026-06-24).** This spec was written against the old de Bruijn pentagrid
> viewport-anchor engine, which had a real re-anchor bug and was replaced by the tested
> cut-and-project / substitution engine. The current spec is
> `2026-06-24-penrose-v1-design.md`. Kept for history.

**Status:** superseded
**Date:** 2026-06-23
**Source:** brainstorming session (terminal + visual companion)

## Context

The Penrose experiment is the most algorithmically ambitious thing on the site and the most unfinished. A WIP on `claude/penrose-tiling-exploration-EuACV` holds a research corpus (`research/penrose/`), a de Bruijn pentagrid engine (`src/app/x/penrose/explore/lib/pentagrid.ts`), a working canvas explorer, and a thin landing page. A six-agent review found the math geometrically correct, the viewport-anchor architecture sound and oracle-validated, and the explorer good to use. It also found what separates a WIP from a shipped experiment: zero tests, no share codec, an off-DESIGN palette, inaccurate copy, and one real bug.

The bug is the headline. The exported `Tile.coord` is many-to-one (the review measured 240 tiles collapsing to ~118 coords), so the landing's promise that "the coord under the cursor is still the right one" is false. The proven-unique identity, the pentagrid vertex `(j, k, kj, kk)`, is computed and then discarded.

Brainstorming sharpened the purpose. This is not an explorer with an essay attached. It is a guided introduction to Penrose tilings for people who have never met one: an explorable explanation where small playable figures each teach one idea, ending in a full explorer.

Three deep properties drive the teaching, and they are one structure seen three ways. **Non-locality:** local matching rules are necessary but not sufficient, so laying tiles by them alone hits dead ends. Penrose's anecdote (Ball, *Prospect*): he spotted a university tiling whose edge tile broke the rules, so it "would go wrong somewhere in the middle of the lawn." **Local indistinguishability:** any two tilings share every finite patch yet differ globally, faulting along "veins." **φ-inflation:** each tile subdivides into φ-smaller tiles and composes into φ-larger supertiles indefinitely, with a unique grouping. That unique hierarchy is the hidden skeleton the three expose, and the exact address under the cursor is it made explicit: which two of the five grids cross here and at which lines, the tile's place in the 5D lattice that local rules cannot see.

This is safe at any size because we never lay tiles locally. The de Bruijn pentagrid is global: each tile is a deterministic projection from a 5D lattice. No growth, no backtracking, no invalid configuration reachable. The line indices grow without bound as you pan (a 51-digit integer at 10^50 units out), which is why the address is BigInt and the explorer keeps a BigInt anchor with a small Float64 render offset. Regularity (`Σγ ∉ ℤ` vs the singular symmetric case) is a separate matter, not the address fix; an empirical probe demoted it from this spec's first draft (see centerpiece 2).

## Goal

Ship `/x/penrose` as a teaching experiment: a guided, explorable introduction whose centerpiece is an infinite explorer that always knows the exact tile under your cursor, taught by small playable sketches on the hierarchy spine.

1. **Correct address.** The tile's address is the crossing `(j, k, kj, kk)` (`kj`/`kk` BigInt), proven unique per rhombus and test-gated. The old `cell_UR` 5-tuple collided and is dropped.
2. **Explorer, focused.** Keep the built interaction; add a seed input, click-to-pin, the B1 palette, and the small UX fixes. No overlays bolted on.
3. **Share by tile-address.** seed + pinned tile + zoom in the URL; the pin doubles as the camera origin. Client-side state, no `useSearchParams`.
4. **A Sketch harness** and the figures it powers.
5. **Tests** for the pure math, plus a Playwright smoke and a share round-trip.
6. **A teaching writeup** on the spine, with the experiment badge and footer.
7. **DESIGN.md amendments**, conscious: a Penrose palette and a scoped teaching-animation rule.

Ship in reviewable slices, the way Prime Moments and Tripwire shipped.

## Non-goals

- **No overlays on the explorer.** Inflation and veins are bounded teaching sketches, never explorer modes.
- **Vein overlay is v2.** It slots into the overlay-sketch pattern built for inflation.
- **No seed gallery.** One seed input plus randomize.
- **No full keyboard pan/zoom.** v1 makes the canvas focusable and throttles the aria-live HUD; full keyboard nav is v2.
- **No style toggles, and no tracery.** The midline decoration is dropped.
- **No V1 emblem, no OG cards, no MDX.** Tracked in IDEAS.md.
- **No change to the Go module.** Honest research history, ships nothing.
- **No server-side anything.** No persistence, no precompute, no runtime config change. All client.

## The teaching spine

Single-column scroll, prose and sketches alternating, ending in the explorer.

1. **Meet the two tiles** (static + hover). Thick and thin rhombus, φ in their angles, the edge marks.
2. **The dead-end** (play). Lay tiles by local rules until the patch paints into a corner. Penrose's lawn, playable. Non-locality.
3. **Five grids, one tiling** (play). Draw the five line families, morph each crossing into its dual rhombus. How de Bruijn builds it.
4. **Regular vs singular** (slider on `Σγ`). Watch the symmetric pinwheel (`Σγ ∈ ℤ`, lines concurrent) relax into a generic tiling. What regularity means in the pentagrid.
5. **The golden ratio appears** (play). thick:thin count converging to φ.
6. **Zoom the hierarchy** (inflation overlay, gated by the spike). A bounded patch with its φ-supertiling overlaid; step between depths.
7. **The explorer** (hero). Go anywhere; the exact address always under your cursor.

## Design centerpieces

### 1. One engine, many thin consumers

`lib/pentagrid.ts` is the single source the explorer, all six sketches, the tests, and the v2 demos draw from. Invest in one correct, well-tested engine; keep every consumer small. Move the lib up to `src/app/x/penrose/lib/` (out of `explore/`), since the teaching page shares it too.

### 2. The correctness fix: the crossing identity, test-gated

The exported `cell_UR` 5-tuple is the wrong *kind* of label. A 5-tuple names a region of the plane; a tile is a *crossing* of two grid lines. An empirical probe settled it: across five seeds, `cell_UR` collapses ~50% (324 tiles → 135 distinct), and making the pentagrid regular does not help, it collides regardless. The reason is structural: the 5-tuple records which gap you sit in for each family but forgets which two families actually crossed, and that is exactly what tells two adjacent tiles apart.

So the address is the crossing the enumerator already computes and discards: `(j, k, kj, kk)`. `j, k ∈ {0..4}` are which two grids meet (small ints); `kj, kk` are which line in each, unbounded, so BigInt. The absolute address is `(j, k, anchor.nProj[j] + kj, anchor.nProj[k] + kk)`. This is unique 324/324 in the probe, already computed, and legible ("grids 0 and 1, lines 7000000000000 and -4"). The invariant, enforced by a test: **every tile's `(j, k, kj, kk)` is distinct over any viewport, for any seed.**

Regularity is decoupled and demoted to a teaching topic (sketch 4). The current singular seed renders fine and addresses uniquely, so v1 leaves `gammaFromSeed` as is.

### 3. The explorer, focused

Keep the built interaction (pan, cursor-zoom, pinch, two-finger pan, hover readout, theme reactivity). Add:

- **Seed input** plus randomize. Requires fixing the empty-deps `useEffect` so a new seed rebuilds γ and the anchor.
- **Click-to-pin.** The pin is the shared/selected tile and the camera origin; pinning re-anchors on the tile.
- **B1 palette.**
- **UX fixes:** an affordance hint, `h-screen → h-dvh`, move the HUD off the breadcrumb overlap, stop the per-frame `setTileCount` re-render.
- **Cleanup:** wire `pointToCoordAnchored` for exact hover (tested near the 1e8 boundary) or delete it and `pointToCoordExact`.

### 4. Share by tile-address

A tile's address doubles as the camera position, so a link is one address plus zoom plus seed, shorter and more meaningful than raw coordinates. "Make this my origin" and "share this view" become the same operation.

```
/x/penrose/explore?s=<seed>&t=<tile-address>&z=<zoom>
```

- `s` = seed (absent = default).
- `t` = pinned tile's address `(j, k, kj, kk)`: the two small family indices plus `kj`/`kk` as base62 BigInt (optional; present = pin and center on it).
- `z` = zoom, short fixed-precision float (absent = default).

Two modules, mirroring Prime Moments' `encoding.ts` + `share.ts`:

- `lib/encoding.ts`: base62 BigInt codec, `encode/decodeTileAddress`, `encode/decodeState`. Pure, round-trip tested.
- `lib/share.ts`: URL assembly and debounced `history.replaceState`.

**Mechanism (the AGENTS.md data-flow call, made here):** the explorer is a client canvas. Read URL state once on mount from `window.location.search`; write it with debounced `replaceState` on change. No `useSearchParams`, no Suspense, no data flow into the server components. Within the existing "all routes dynamic, client canvas" model; not an architectural change.

### 5. The Sketch harness

`Sketch.tsx`: a client primitive wrapping a render area (canvas or SVG) and a control bar (play/pause, step, reset, optional slider). It owns the `requestAnimationFrame` loop and the reduced-motion contract; each sketch supplies a `step`/`render(t)`.

**Reduced motion is a hard contract.** Nothing autoplays; motion happens only on play or slider drag. Under `prefers-reduced-motion`, sketches render the end state and never move on load. This is what lets us amend DESIGN.md without breaking its restraint.

### 6. The inflation spike, contained

The inflation overlay is the one piece existing research did not de-risk. A naive φ pixel-scale is a lie; it will not align with the true supertile grouping. The correct version needs the exact γ→γ′ transform plus the φ scaling. De Bruijn derived this in the pentagrid framework, so it exists, but it will not be vibed. Scope it as a research exercise, like the rest of that folder:

- `research/penrose/05-inflation.ts` + `.md`: derive the transform, validate against the exact oracle that inflated vertices coincide with the expected supertile vertices.
- Only after it validates do we build the overlay sketch and `inflation.test.ts`.
- The spike is isolated. If the math is gnarly, the overlay slips to v2 and the rest of v1 ships.

### 7. Palette B1 and the DESIGN.md amendments

The chosen look (validated in the companion against the real tiling) is **B1 Mosaic**: solid fills, the dark `--paper` as grout, gold thick, teal thin, an `--ink` ring on the pin. Gold and teal are the Prime Moments constellation hues, so the site keeps one color language; the teal is nudged lighter on dark.

Two conscious amendments, scoped as the constellation ring is scoped:

**Color.** Add `--color-penrose-*` tokens, both modes:

| Role | Light | Dark |
| --- | --- | --- |
| thick | `#C89B3C` | `#C89B3C` |
| thin | `#3E6B7C` | `#4f7d92` |
| grout | `--paper` | `--paper` |
| pin ring | `--ink` | `--ink` |

**Animation.** DESIGN.md lists animation under "Not in the language (yet)." Amend to permit user-initiated teaching animation only: a figure may move on play or slider drag, must respect `prefers-reduced-motion`, and is confined to teaching experiments. No autoplay, no ambient motion.

## Tests

Table-driven `bun:test` where the shape fits.

- `lib/pentagrid.test.ts`: address uniqueness, every tile's `(j, k, kj, kk)` distinct over a sampled viewport across seeds (the headline guard); coverage / no-overlap on sampled points; thick:thin → φ; anchored vs exact agreement at anchor 0 and near the 1e8 boundary; enumerate → `tileContains` round-trip.
- `lib/encoding.test.ts`: round-trip seed / tile-address / zoom, including large BigInt addresses.
- `lib/inflation.test.ts` (after the spike): inflated vertices coincide with supertile vertices.
- Playwright: `/x/penrose` loads and sketches mount; `/x/penrose/explore` mounts the canvas; a `?s=&t=&z=` URL loads and centers on the pin.

## The writeup

Teaching, on the spine, accurate. Prose interleaved with the sketches, ending in the explorer. Add the numbered badge (Penrose is the third experiment by publish date, `experiment 03`) and the "an experiment by nathan toups" footer, matching Prime Moments. Depth over volume.

Housekeeping in `research/penrose/`: fix the README question-count contradiction (three / four / five in three places), mark exercise 02 superseded (it benchmarked int32, not the BigInt address), add `05-inflation`. The copy is accurate about share, which now ships.

## Files

```
src/app/x/penrose/
  page.tsx                     teaching page: prose + sketches, hero link
  lib/                         shared engine (moved up out of explore/)
    pentagrid.ts               engine + address fix; inflation transform after spike
    encoding.ts                base62 + state codec
    share.ts                   URL assembly + replaceState
    pentagrid.test.ts  encoding.test.ts  inflation.test.ts
  components/
    Sketch.tsx                 harness
    MeetTheTiles.tsx  DeadEnd.tsx  FiveGrids.tsx
    RegularVsSingular.tsx  GoldenRatio.tsx  InflationOverlay.tsx
  explore/
    page.tsx                   full-bleed explorer route
    PenroseExplorer.tsx        seed, pin, palette, UX fixes; imports ../lib

research/penrose/05-inflation.ts / .md     the spike
research/penrose/README.md                 fix count; mark 02 superseded
src/app/globals.css                        + --color-penrose-* tokens
DESIGN.md                                  + palette; + teaching-animation rule
src/app/x/page.tsx                         refresh the Penrose blurb
```

## Build order (slices)

Each slice is independently reviewable and lands with its tests.

1. **Engine + address fix + tests.** Move lib up; expose the crossing `(j, k, kj, kk)` as the `Tile` address (`kj`/`kk` BigInt), drop `cell_UR`; prove uniqueness over a sampled viewport. Nothing proceeds until that test is green.
2. **Encoding + share + explorer wiring.** The codec and its tests; seed input (with the effect fix), click-to-pin, URL read-on-mount and debounced write; share round-trip E2E.
3. **Explorer polish + palette.** B1, the `--color-penrose-*` tokens, the color amendment, the UX fixes, dead-export cleanup.
4. **Sketch harness + core sketches.** `Sketch.tsx` with the reduced-motion contract, the animation amendment, then the intro and four sketches.
5. **Inflation spike → overlay sketch.** Validate against the oracle, then build the sketch and its test. Slips to v2 if it does not validate.
6. **Teaching page + writeup.** Assemble the page, the prose, badge and footer, README fixes, index blurb.

## Open risks

- **The inflation transform** (slice 5) is the one unproven piece, test-gated against the exact oracle; it slips to v2 if it does not validate. (The address question is resolved: a probe across five seeds confirmed `cell_UR` collides ~50% regardless of regularity, while `(j, k, kj, kk)` is unique 324/324.)
- **The dead-end sketch** (slice 4) is a bounded, deterministic scripted sequence, not a live solver, so it always reaches the same teachable conflict.

## v2

Vein overlay sketch (two seeds); full keyboard navigation; style toggles, V1 emblem, OG cards. The architecture stays ready.
