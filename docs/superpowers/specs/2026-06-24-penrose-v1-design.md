# Penrose — v1 Design (rewrite)

**Status:** spec
**Date:** 2026-06-24
**Supersedes:** `2026-06-23-penrose-v1-design.md` (written against the old de Bruijn
pentagrid viewport-anchor engine, since replaced)

## Why this is a rewrite

The prior spec was built on the explorer's old engine: a de Bruijn pentagrid with a
BigInt viewport anchor and a Float64 render offset. That engine has a real bug. It does
not preserve the tiling across a nonzero re-anchor (`research/penrose/STATUS.md`,
Corrections). Its exported address `(j, k, kj, kk)` and the whole "cell_UR collides"
framing belong to that engine.

The engine was replaced, not patched. A tested cut-and-project / substitution engine now
lives in `research/penrose/cap/` with a passing test suite (`bun test
./research/penrose/cap/` → 34 pass; 24 `test()` blocks, several table-driven). It
reproduces classical de Bruijn
theory (de Bruijn 1981/1990; D'Andrea 2023, *A Guide to Penrose Tilings*) exactly. The
address is now the de Bruijn ℤ⁵ coordinate `n = (n₀..n₄)`, and a rhombus is `[n; j, k]`.
See `research/penrose/STATUS.md` for provenance.

Everything in the prior spec that was about the *product* carries over unchanged. The
guided explorable-explanation framing, the teaching spine, the B1 Mosaic palette,
share-by-address, the reduced-motion contract and Sketch harness, the experiment chrome.
This rewrite keeps all of that and re-grounds the engine-dependent parts on `cap/`.

## Goal

Ship `/x/penrose` as a teaching experiment: a guided, explorable introduction to Penrose
tilings whose centerpiece is an explorer that always knows the exact tile under your
cursor, taught by small playable sketches on the φ-inflation spine.

Build order is explorer first, then the learning tool. The explorer proves the engine
works for real users; the sketches then teach what it is doing.

## The three teaching properties (engine-independent, carried over)

One structure seen three ways.

- **Non-locality.** Local matching rules are necessary but not sufficient, so laying
  tiles by them alone hits dead ends. Penrose's lawn anecdote (Ball, *Prospect*): an edge
  tile broke the rules, so the tiling "would go wrong somewhere in the middle of the
  lawn."
- **Local indistinguishability.** Any two Penrose tilings share every finite patch yet
  differ globally. You can never tell which tiling you are in from any finite view.
- **φ-inflation.** Each tile subdivides into φ-smaller tiles and composes into φ-larger
  supertiles indefinitely, with a unique grouping. This hierarchy is the hidden skeleton,
  and the exact ℤ⁵ address under the cursor is that skeleton made explicit.

The engine swap strengthens this. φ-inflation was a "math might not validate" risk in the
prior spec. It is now solved and tested: it is the integer operator `A` (eigenvalues −φ,
1/φ, 2) and the closed-form fold `coord' = −A·coord + m·ones`, which is D'Andrea Theorem
5.16.

## Scope decisions (this rewrite)

### 1. Bounded world, staged seams

v1 ships a **bounded explorer**: one large patch generated from the origin (deflation
level ~8–10, tens of thousands of tiles), with pan and cursor-zoom as camera math over
that fixed tile set. Every tile carries its exact ℤ⁵ address from the tested lift.
Hit-testing under the cursor reads that address out.

The level is bounded by render cost and reach (how far you can roam), not by precision.
The integer ℤ⁵ address stays exact in Float64 far past any renderable level: components
grow like O(φ^N), about 49 at level 10, against the 2⁵³ ≈ 9e15 exact-integer limit; level
10 is roughly 55k faces and a ~350ms one-time build. What forces v2 is far-from-origin
physical-position precision under unbounded pan, not the address.

True infinite pan is **v2**. It needs three coupled, currently-unbuilt subsystems
(viewport-clipped pruned-deflation generation, BigInt + golden-field exact arithmetic for
the window membership test, and a self-contained canonical frame for far-from-origin
anchoring). Each is real engineering with its own correctness oracle. v1 is built with
clean seams (an address/codec layer and a camera layer that do not assume float) so v2
slots in without a rewrite.

### 2. One canonical tiling; a seed is a coordinate into it

There is essentially one Penrose tiling up to local isomorphism (the property the sketches
teach). v1 models exactly that. The engine generates one canonical tiling, the
sun-centered deflation. A **seed is a starting coordinate / region** in that tiling, and
**randomize teleports to a new region**. Variety is real because the tiling is
non-periodic: every region looks locally different. The seed is itself an address, which
is the thesis of the whole experiment.

This replaces the old "seed = different `gamma` = different tiling" model. It is more
truthful to the math, efficient (lift once, roam), and avoids the O(radius⁵) brute-force
`generate()` path. The default view is a generic off-center region, reached as a camera
translation over the sun-centered substitution patch: the engine center stays the singular
5-fold sun, the camera starts off it. A seed coordinate maps to a camera center; the sun
is reachable but is not the landing view. (Seed → camera-center mapping is an open
planning question below.)

### 3. Explorer first, learning tool second

v1 sequences the explorer (engine port, renderer, addressing, pin/share) ahead of the
teaching spine (landing writeup, Sketch harness, sketches). The full learning tool is in
scope; it is built after the explorer is live.

## Architecture

### Engine packaging (needs maintainer sign-off at review)

Port `research/penrose/cap/{cap,deflate,bridge,fold,faces}.ts` and their `.test.ts` files
into `src/app/x/penrose/explore/lib/` verbatim, making them app code. The research notes
(`research/penrose/05`–`09`, `STATUS.md`) stay where they are as the writeup source.
Delete the old `src/app/x/penrose/explore/lib/pentagrid.ts`.

Rationale: AGENTS.md requires experiments to be self-contained and ship with func.lol. The
tested engine is the experiment's core; it belongs in the experiment. Importing across the
`research/` boundary is a gray area and couples app builds to research scratch. The engine
is small and already test-covered, so the port is a move plus a path fixup, and the tests
move with it.

This is an architectural change. It is presented here for sign-off; no code moves until
the spec is approved.

### Coordinate frames (from the engine)

Three origin-centered frames, all in the tested engine:

- **ℤ⁵ coord** `n = (n₀..n₄)`, the address. `index = Σ nₗ ∈ {1,2,3,4}` for valid vertices.
  Integer, exact, deep-zoom-safe. The tile identity for hit-testing and the URL.
- **Physical** `physical(n) = Σ nₗ·(cos 2πl/5, sin 2πl/5)`, edge length 1. The explorer
  renders in the closely related `LiftedVertex.pos` frame, a fixed rotation of this (see
  "One frame, pinned" below). Do not mix the two.
- **Internal** `internal(n)`, not drawn. The bounded membership space that makes this a
  quasicrystal rather than a grid.

`scale = φ^level` is the single conversion constant between raw deflation geometry and
unit-edge physical geometry. The explorer works in the lifted (scaled) `pos` frame where
edges are ≈ 1 and coords are attached.

### The data the explorer renders

The substitution path is the rich one. `substitutionFaces(level)` returns
`{ faces: Face[], verts: LiftedVertex[] }` in one call:

- `LiftedVertex = { pos: Pt, coord: readonly number[] }` (length 5 by construction) —
  physical position plus exact ℤ⁵ address.
- `Face = { key: string, type: "thick" | "thin" }` where `key = "n.join(',')|jk"`. The four
  corners are the coords `n, n+eⱼ, n+eₖ, n+eⱼ₊ₖ`. Proven exact vs the substitution (no
  phantoms, none missing).

**One frame, pinned.** Render and hit-test exclusively in the `LiftedVertex.pos` frame.
`pos` and `physical(coord)` are NOT the same frame: `lift()` integrates coords in a frame
rotated from `pos` by a fixed offset, so they differ by a pure rotation (measured up to ~2
units apart at level 4). The patch builder looks up each corner's position by its coord key
in the `verts` set, never via `physical()`. All geometry (corners, centroid, hit-test)
lives in the `pos` frame.

The explorer needs three thin layers the engine does not yet provide. They are v1 work
items, all built on the tested core and individually testable:

- **Patch builder.** Wrap `substitutionFaces(level)` into a render model: a `Map` from
  coord key to `LiftedVertex.pos`, and per face its four corner positions (looked up in
  that map) plus centroid, keyed by `Face.key`, all in the `pos` frame. A static set; built
  once per session (and once per seed/randomize jump).
- **Hit-testing.** Map a physical (x, y) under the cursor to a face. Point-in-rhombus
  against precomputed corners, accelerated by a uniform spatial grid bucket (the tiling is
  near-uniform density, so a grid keyed on physical position is enough). Returns the
  `Face` and its `coord`.
- **Address codec.** Encode/decode the ℤ⁵ address (and the camera) for the URL. Pure,
  validated, with a base62 form for the integer components. Built to the
  prime-moments codec precedent (strict parse, return null on bad input).

## The explorer (bounded)

Salvage the rendering and interaction layer of the current `PenroseExplorer.tsx`, which is
good: native 2D canvas with `devicePixelRatio` + `ResizeObserver`, refs-not-state for all
camera values, a RAF dirty-flag render loop, unified Pointer Events with pinch when two
pointers are down, wheel zoom pivoting on the cursor, theme colors read live from CSS vars
with a `MutationObserver` on `data-theme`. Keep this nearly verbatim.

Replace the state model that was coupled to the buggy Float64 viewport anchor
(`anchorRef`/`offsetRef`/`maybeReAnchor`/`makeAnchor`/`enumerateTiles`). The new model:

- One patch built from the seed region at mount. Camera is pan + zoom over the fixed set.
- `drawFaces` fills each rhombus solid (B1 Mosaic), strokes the grout. No per-frame React
  state; the HUD reads through refs and a throttled `useState` for the address line.
- Hover reads the face under the cursor and shows its address. Click pins it.

Interaction commitments (carried over): pan, cursor-zoom, pinch, two-finger pan, hover
readout, theme reactivity, seed input + randomize, click-to-pin.

UX fixes carried over: an affordance hint on first load, `h-dvh` not `h-screen`, the HUD
clear of the breadcrumb, no per-frame `setState`.

Accessibility carried over: focusable canvas, throttled `aria-live` address HUD. Full
keyboard pan/zoom is v2.

### Pin, origin, share are one operation

Click-to-pin selects a tile. The pin is the shared tile and the camera origin at once.
"Make this my origin" and "share this view" are the same action. Re-rooting is cheap and
consistent in the bounded model (the pinned tile's `coord` is exact; the camera recenters
on its physical position). No re-anchor, so no re-anchor bug.

## Share by address

URL scheme on the explore route:

```
/x/penrose/explore?s=<seed>&t=<tile-address>&z=<zoom>
```

- `s` absent → default seed. `t` present → pin and center on that tile. `z` absent →
  default zoom.
- Client-side only: read `window.location.search` once on mount, write with debounced
  `history.replaceState`. No `useSearchParams`, no Suspense, no server data flow. The root
  layout reads `cookies()` for the theme so pages already render per-request (DESIGN.md,
  light/dark toggle); this experiment adds no runtime export and no architectural change,
  so the URL approach needs no separate sign-off.
- `t` encodes the ℤ⁵ address (5 integers) compactly via the base62 codec. `s` encodes the
  seed coordinate the same way. The codec is the engine-independent seam for v2 (when
  addresses become BigInt, only the codec widens).

## The teaching spine (built after the explorer)

Single-column scroll, prose and sketches alternating, ending in the explorer hero. Depth
over volume. Experiment badge and "an experiment by nathan toups" footer matching Prime
Moments. Verify the experiment number against the current `labs[]` publish order before
hard-coding it.

### Sketch harness

`Sketch.tsx`, a client primitive: a render area (canvas or SVG) plus a control bar
(play/pause, step, reset, optional slider). It owns the RAF loop and the reduced-motion
contract. Each sketch supplies `step` and `render(t)`.

**Reduced-motion hard contract.** Nothing autoplays. Motion only on play or slider drag.
Under `prefers-reduced-motion`, render the end state and never move on load.

### Sketches in v1

The set and order, and how each grounds on the new engine:

1. **Meet the two tiles** (static + hover). Thick and thin rhombus, φ in the angles, the
   edge marks. Authored geometry.
2. **The dead-end** (play). Lay tiles by local matching rules until the patch paints into a
   corner. Penrose's lawn anecdote, playable. A bounded, deterministic *scripted* sequence,
   authored content, deliberately not from the engine (it demonstrates local-rule failure,
   which the global engine never does).
3. **The golden ratio appears** (play). thick:thin rhombus count converging to φ, from
   `thickThinRatio` over `substitutionFaces(level)` across levels (the rhombus picture the
   sketch shows; `colorCounts` counts triangles, a different object).
4. **Zoom the hierarchy** (inflation overlay). A bounded patch with its φ-supertiling
   overlaid; step between depths. Math is solved (operator `A` / the fold); this is overlay
   rendering on a tested transform, no longer a research risk.
5. **The explorer** (hero). Go anywhere in the patch; the exact address always under the
   cursor.

Deferred to v2 (they need the most rework against cut-and-project, decided in this
rewrite): **Five grids, one tiling** (the de Bruijn dual picture, now one of two
equivalent views rather than how the explorer computes) and **Regular vs singular** (its
old slider rode `Σγ`; in cut-and-project the analogue is the internal-window offset and
five-line concurrency, a new mechanism to design).

## Palette: B1 Mosaic (needs maintainer sign-off at review)

Solid fills, dark `--paper` as grout, gold thick, teal thin, an `--ink` ring on the pin.
Gold and teal reuse the Prime Moments constellation hues so the site keeps one color
language; teal is nudged lighter on dark.

Proposed `--color-penrose-*` tokens. They reuse the existing constellation hues, so the
palette adds no genuinely new color: thick is gold `#C89B3C` (= `--color-moment-1`), thin
is teal `#3E6B7C` (= `--color-moment-4`). One departure: thin is nudged lighter on dark
(`#4f7d92`) for contrast against the dark `--paper`, which needs a `[data-theme="dark"]`
override (like `--paper`/`--ink`/`--subtle` have, unlike the mode-invariant constellation
tokens). So the tokens live in `@theme` like the constellation ring, with a single dark
override for thin.

| role     | light                    | dark                     |
| -------- | ------------------------ | ------------------------ |
| thick    | `#C89B3C` (gold = moment-1) | `#C89B3C`             |
| thin     | `#3E6B7C` (teal = moment-4) | `#4f7d92` (lighter)   |
| grout    | `--paper`                | `--paper`                |
| pin ring | `--ink`                  | `--ink`                  |

Consumed through one thin helper (`explore/lib/colors.ts`) that maps roles onto the
tokens, mirroring `prime-moments/lib/colors.ts`. Canvas reads them live via
`getComputedStyle` so they invert with the theme.

**DESIGN.md amendments**, conscious and minimal:

1. Add the `--color-penrose-*` tokens to the color section. Note they reuse the
   constellation hues (gold = moment-1, teal = moment-4), so no new hue enters the
   language; the only new value is the dark teal shade.
2. Qualify the "Not in the language (yet)" list: "a second accent color" /
   "per-experiment custom styling" are relaxed for experiments that reuse existing
   constellation hues through a scoped helper. Update the `globals.css` comment
   "the only color on the site" to acknowledge the penrose roles reuse those same hues.
3. Add a scoped teaching-animation rule: user-initiated motion only, respect
   `prefers-reduced-motion`, confined to teaching experiments, no autoplay or ambient
   motion.

Adding named color and amending DESIGN.md are architectural per CLAUDE.md. Presented for
sign-off; no tokens land until approved. This lives in a later polish slice, so it does
not block the explorer start.

## Testing

Engine: the `cap/` suite (34 pass, 24 `test()` blocks with table-driven cases) moves with
the port and must pass in its new home (`bun test ./src/app/x/penrose/`).

New v1 unit tests (colocated, table-driven where the shape fits):

- **Patch builder.** Face count grows ~φ² per level; every face has four finite corners;
  centroids distinct.
- **Hit-testing.** For a sampled set of points strictly inside known faces, the hit returns
  that face; points in the grout return none; round-trip face → centroid → hit is the same
  face.
- **Address codec.** Round-trip `s` / `t` / `z`, including negative and multi-digit ℤ⁵
  components; bad input returns null (strict parse).
- **Multi-scale consistency** (the property the old anchor violated), a v2-seam guard: a
  tile's address from `nextCoordCanonical` (the self-contained fold, valid in the canonical
  {1,2,3,4} band) matches the lift's address for the same tile. The fully self-contained
  absolute frame is an open item in STATUS.md (`nextCoord` still reads its band-min from a
  lift), so the test uses the canonical fold to stay lift-independent. v1 builds one
  fixed-level patch and never refines at runtime, so this only guards the v2 seam.

E2E (Playwright): `/x/penrose` loads and the page mounts; `/x/penrose/explore` mounts the
canvas; a `?s=&t=&z=` URL loads and centers on the pin (header-level assertions, the repo's
E2E style).

## Build slices (ordered, each lands with its tests)

1. **Engine port.** Move `cap/` into `explore/lib/`, fix paths, delete `pentagrid.ts`, all
   tests green in the new location (`bun test ./src/app/x/penrose/` → 34 pass; this adds the
   `*.test.ts` files to the app test run, a test-surface change, not a runtime one). No
   behavior change.
2. **Patch builder + hit-testing.** The two render-model layers, with their unit tests. No
   UI yet.
3. **Explorer rewrite.** Salvage the canvas/interaction layer; wire it to the patch builder
   and hit-testing; hover address HUD; seed + randomize (seed = region). Drop the old
   anchor model.
4. **Pin + share.** Address codec; pin = origin = share; the `s/t/z` URL; client-side
   read-once / debounced write. Share round-trip E2E.
5. **Palette + polish.** B1 Mosaic tokens + the DESIGN.md amendments (sign-off gated);
   `explore/lib/colors.ts`; the UX fixes; rewrite the superseded "infinite / de Bruijn
   pentagrid" copy off the new addressing story in all three surfaces: the `labs[]` blurb
   in `src/app/x/page.tsx`, and the metadata/prose in `x/penrose/page.tsx` and
   `x/penrose/explore/page.tsx`.
6. **Teaching spine.** Landing writeup, Sketch harness, sketches 1–5 in order. Reduced-
   motion contract.

## Non-goals (v1)

- No infinite pan, no BigInt deep-zoom. v2, with its own test suite.
- No overlays bolted onto the explorer. Inflation is a bounded sketch, never an explorer
  mode. Vein overlay is v2.
- No seed gallery. One seed input plus randomize.
- No full keyboard pan/zoom. v2.
- No style toggles, no tracery (the midline decoration is dropped).
- No server-side anything, no persistence, no precompute. Pure client compute.
- No emblem, no OG cards, no MDX.

## Open questions for planning

- **Patch level.** Pick the deflation level that balances tile count (render cost) against
  reach (how far you can roam) while keeping Float64 coords exact. Likely 8–10; confirm by
  measuring coord magnitude and frame time.
- **Randomize range.** In the bounded patch, randomize jumps within the generated region.
  Confirm the region is large enough that randomize feels like "somewhere new" and define
  how a seed coordinate maps to a camera center.
- **Sun center.** Decide whether the famous 5-fold sun center is surfaced as a named
  landmark or simply reachable. Default view is generic, off-center.
- **Experiment number.** Re-confirm publish order against the current `labs[]` before
  hard-coding the badge.
