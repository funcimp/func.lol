# Penrose — Unbounded Viewport Generator (edgeless plane)

**Status:** spec
**Date:** 2026-06-24
**Builds on:** `2026-06-24-penrose-v1-design.md` (the shipped bounded explorer). This
replaces the explorer's generation path; the rest of the explorer (camera, pin, share,
hit-test, render loop) stays.

## Why

The shipped explorer builds one large patch at mount and pans over it, so it has an edge
you reach by panning out. We want an **edgeless** plane: as the camera moves, generate
only the tiles in view. The earlier worry (BigInt, exact golden-field arithmetic, three
coupled subsystems) turned out to be unnecessary. Two experiment results decide the
design:

- **Float64 is exact out to radius ~10¹⁴ unit edges.** A camera at zoom 4 to 800 px/edge
  cannot be panned anywhere near that by hand. So float64 is safe with ~11 orders of
  magnitude to spare, and no BigInt is needed for the explorer. (A future jump-to-a-far-
  coordinate feature is the only thing that would need exact arithmetic; out of scope.)
- **The shipped "sun" tiling is the singular pentagrid (offset 0), which is the hardest
  case to generate this way** (lines concurrent at the center, tiles sitting exactly on
  the acceptance boundary). A **generic** (non-singular) tiling has none of that, is far
  more robust, and is locally indistinguishable from the sun. The maintainer chose the
  generic tiling.

## The decision (settled)

Show a fixed **generic** Penrose tiling, generated per viewport. Every finite patch of it
is identical to a patch of the shipped sun tiling (local indistinguishability), so nothing
is lost in what the user sees or learns. Costs, both acceptable for a WIP preview:

- The default landing view changes: no perfectly-symmetric 5-fold sun star at the center.
- Share links minted by the current bounded preview stop resolving (their addresses are in
  the sun's gauge; the generic tiling has its own gauge). No real links exist yet.

## Architecture

### The generator: fixed-gamma pentagrid enumeration

A de Bruijn pentagrid is five families of parallel lines; family `l` is the level sets of
`f_l(z) = Re(z·conj(ζ^l)) = x·PCOS[l] + y·PSIN[l]` (the engine's `cap.PCOS/PSIN`). A fixed
shift vector `γ` (one offset per family) places the lines. Each crossing of a line from
family `j` with a line from family `k` is one rhombus. Enumerating only the crossings
inside the viewport is O(visible), not the O(N⁵) box scan of the existing `generate()`.

`γ` is **generic**: `Σγ_l = 0`, irrational, chosen so no five lines are concurrent and no
crossing lands on a window boundary. The exact value is a planning detail, pinned as a
constant and validated by a test (below). Genericity is what removes every degeneracy the
singular sun has.

**The crucial subtlety (verified by prototype):** a tile's render position is
`physical(K)`, not the line-crossing point `z`. They differ by a fixed scaling,
`physical(K) = (5/2)·z + physical(γ) + b`, where `b = Σ t_l ζ^l` is bounded by `τ` (the
golden ratio). So the crossing point sits ~2/5 of the way toward the origin from the tile
body, and that gap grows without bound with distance. **Filter by the tile body, never by
`z`.** (The first prototype filtered by `z` and silently dropped every off-center tile; the
oracle missed it because it only tested origin-centered regions.)

**Enumerate a physical viewport rectangle `V`:**

1. **Map `V` into grid space.** Invert the scaling: `z ≈ (2/5)(physical − physical(γ))`.
   Map `V`'s corners to a grid-space region `Z`, expanded by a constant grid margin
   `GRID_MARGIN ≥ (2/5)·τ ≈ 0.65` (use 1.0) that covers the bounded `b`. Because `b` is
   bounded, this margin is constant at any distance, which is what makes panning far work.
2. **Line-index ranges over `Z`.** For family `l`, indices `m ∈ [ceil(min f_l + γ_l),
   floor(max f_l + γ_l)]` over `Z`'s corners.
3. **Solve crossings.** For each pair `j<k` and each `(m_j, m_k)`, solve the 2×2 system for
   `z`; skip `z` outside `Z`.
4. **Local address.** `K_l = ceil(f_l(z + ε(ζ^j+ζ^k)) + γ_l)` (ε≈1e-7 nudge to disambiguate
   the on-line `ceil`), then force `K_j = m_j`, `K_k = m_k`. `K` is the base corner (min on
   axes `j,k`), no path from any origin. This locality is what makes the plane unbounded.
5. **Filter by the tile body.** Corners are `n, n+e_j, n+e_j+e_k, n+e_k` at `cap.physical`
   of each; keep the tile iff its centroid (their mean) lies in `V` grown by a one-tile
   physical margin (~1.5). De-dupe by key.

`RenderFace`: thick/thin by `|j−k| ∈ {1,4}` vs `{2,3}`; key `"n0,n1,n2,n3,n4|jk"` identical
to `faces.ts`/`patch.ts`, so `codec`, `findFaceByTile`, hit-test, and pin/share all work
unchanged.

`γ` relates to the camera's window center `(vx,vy)` by
`γ_l = (2/5)(vx·ICOS[l] + vy·ISIN[l])`. Two *different* projections of `γ` appear and must
not be mixed: `internal(γ) = Σ γ_l ζ^{2l} = (vx,vy)` is the window center (which `γ` is
derived from), while `physical(γ) = Σ γ_l ζ^l` is used in the step-1 inverse map.

### Frames

`cap.physical` is the ζ^l frame. The shipped explorer rendered in a frame rotated ~18° from
it (an artifact of the substitution lift). Since the generic tiling has no continuity
requirement with the shipped one, **render directly in the ζ^l frame** (no rotation). The
hit-test grid and render loop are frame-agnostic (they consume corner positions), so the
orientation is a free visual choice; pick a fixed global rotation constant only if a
particular orientation looks best, and apply it identically to every corner.

### Chunk cache and seams

Divide **physical** world space into fixed square cells (side ~8 unit edges; a planning
constant). A cell owns every rhombus whose **`physical(K)` centroid** falls inside it, with
half-open bounds `[min, max)`. Generate a cell by mapping its physical bounds into the
grid-space search region (the same ×2/5 inverse), so it finds every tile whose body touches
it even though the crossing sits closer to the origin. Memoize `Map<cellKey, RenderFace[]>`,
LRU-evict cells outside the viewport plus a margin ring. Adjacent cells tile with **no seam
and no overlap** because each tile's centroid lies in exactly one half-open cell; the union
of per-cell results reconstructs the whole, de-duped by key. (Verified: grid seams near and
far from origin reconstruct key-for-key with zero lost, zero double-owned.) Note the
`facesInViewport` enumerator returns a one-tile border halo beyond `V`; a cell doing exact
partitioning re-applies half-open centroid ownership rather than trusting the raw set.

Per camera change: compute the visible cell range, generate any newly exposed cells,
collect their faces, refresh the hit index over the visible set, render. Generation is
cheap (a few hundred to low-thousands of crossings per viewport, each a 2×2 solve plus a
projection), so it runs on the main thread on camera change with no worker. Mount is
instant (no whole-plane build, no "building tiling" freeze).

### Precision

Float64 throughout. Safe to radius ~10¹⁴ unit edges, unreachable by hand. The decimal tile
codec is already the documented seam for a future BigInt/exact-arithmetic jump-to-coordinate
feature; not built here.

## Integration with the explorer

- Replace the mount-time `buildPatch(PATCH_LEVEL)` + one-fixed-patch model with the chunk
  cache fed by the pentagrid generator. The render loop computes the viewport rect (it
  already does, for culling) and draws the visible cells' faces.
- `seedToCenter` / default view: the generic tiling has no `[0,0,0,0,0]` sun center. Pick a
  deterministic default camera position (a fixed point in the ζ^l frame), and keep the
  seed → camera-center mapping (a seed hashes to a starting position/address).
- Pin, hover, share, camera, theme, accessibility: unchanged. They consume `RenderFace`s
  and a hit index; only the source of those changes.

## Reuse vs new

**Reused unchanged:** `cap.PCOS/PSIN/physical/index`, the `RenderFace` type, `hitTest.ts`
(`buildHitIndex`/`hitFace`, rebuilt over the current visible face set on each
regeneration), `codec.ts` (the 7-integer wire format), the entire render/pointer/zoom/pin/
share machinery in `PenroseExplorer.tsx`. The substitution engine (`deflate/lift/faces/patch`) stays as the
tested foundation and as the source for later teaching sketches; it is no longer the
explorer's render path.

**New:** one module (`pentagrid.ts`): line-range, crossing solve, local address, and
`facesInViewport(rect, γ)` returning `RenderFace[]`. A chunk cache with LRU eviction. The
fixed `γ` (and optional orientation) constant. Wiring in the component to generate per
viewport instead of once at mount.

## Correctness and testing

The existing slow but tested `generate(radius, vx, vy)` (cut-and-project, O(N⁵)) is the
**oracle**: for the chosen `γ`'s equivalent window offset, the fast pentagrid enumerator
must produce exactly the same faces as `extractFaces` over `generate()` on a bounded
region. This is the headline test (fast path == proven slow path), key-for-key.

Other tests:

- **Genericity guard:** the chosen `γ` yields no concurrent lines and no crossing within
  epsilon of a window boundary over a sampled region (so there are no ties to break).
- **Tiling validity:** every face is a unit-edge rhombus; thick:thin ratio over a region
  → φ; no two faces overlap and the region is fully covered (corner-acceptance holds).
- **Seam test:** a region generated as one block equals the union of its chunk cells,
  key-for-key, with no missing or duplicated tiles at cell boundaries.
- **Address locality:** a tile's `K_l` computed at its crossing equals the address derived
  from its corners (internal consistency), and is stable when the same tile is reached from
  a different viewport.
- **Share round-trip:** encode a generated tile's address, decode, `findFaceByTile` in a
  freshly generated viewport returns the same tile (the unbounded analogue of the bounded
  round-trip test).
- **E2E:** pan far in one direction and confirm tiles keep appearing (no edge, no blank
  grout) and the address HUD keeps reading.

## Non-goals

- No BigInt / exact-arithmetic. Float64 only; the far-radius wall is unreachable.
- No reproduction of the sun tiling or its addresses; no continuity with current preview
  links.
- No Web Worker (generation is cheap and incremental).
- No jump-to-arbitrary-coordinate feature.
- No change to the substitution engine or the teaching-spine plans.

## Open questions for planning

- **The `γ` constant.** Pick a vetted generic vector (`Σ = 0`, irrational, no degeneracy)
  and pin it; the genericity guard test validates it. Determine its equivalent
  `(vx, vy)` window offset so the `generate()` oracle test can use the matching window.
- **Cell size** (the chunk grid step) and **eviction margin**: tune for smooth panning vs
  cache memory; start ~8 unit edges and one margin ring, measure.
- **Default view / seed mapping.** A fixed default camera position in the generic tiling,
  and how a seed string maps to a starting position/address (the bounded explorer hashed
  the seed to a face centroid; the analogue here hashes to a world position).
- **Orientation.** Whether to apply a fixed global rotation for aesthetics or render raw
  ζ^l. A visual call, decided during the build.

## Build slices (each lands with its tests)

1. **The enumerator core.** `pentagrid.ts`: line-range, crossing solve, local address,
   `facesInViewport(rect, γ)`. Test against the `generate()` oracle (key-for-key on a
   region) and the genericity + tiling-validity guards.
2. **Chunk cache + seams.** The cell cache, eviction, and the seam test.
3. **Explorer integration.** Replace the mount-time patch with per-viewport generation;
   default view / seed mapping; hover and pin against the generated set. E2E: pan-forever,
   address keeps reading.
4. **Share round-trip** in the new gauge, plus the landing/explore copy updated off the
   edgeless-plane story.
