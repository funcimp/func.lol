# Penrose — Path addressing, the base-A number system, and applications

Research note. Records the addressing model that fell out of the Z⁵ pivot (the path
↔ coordinate equivalence, the inflation matrix as a number-system base, recursive
multi-scale navigation) and the application ideas it opens up, including procedural
infinite-plane level design. Forward-looking: a model and a set of leads, not yet
built.

## The addressing model

### Path and coordinate are the same thing (event sourcing)

A tile can be named two ways, and they are equivalent:

- **Path** (event log): the sequence of inflate / move / deflate operations that
  reaches the tile from a fixed origin.
- **Coordinate** (materialized view): the absolute de Bruijn Z⁵ 5-tuple.

`coordinate = fold(path)`. Replaying the path accumulates the Z⁵ operations and
lands on the absolute 5-tuple. The path is the source of truth (cheap, frame-free,
relative); the coordinate is derived (you pay a replay to materialize it). The
canonical root-to-tile hierarchy path is in bijection with the coordinate; arbitrary
navigation paths fold many-to-one onto the same coordinate, exactly as many event
logs fold to one state.

### The path is the coordinate written in base A

φ-inflation is the integer circulant matrix `A` on Z⁵ (validated: it acts as exactly
−φ on the physical plane, machine precision). A tile's coordinate expands as

```
n = offset₀ + A·offset₁ + A²·offset₂ + … + Aᵏ·offsetₖ
```

where each `offsetᵢ` is the small Z⁵ child-displacement chosen at level `i` (a digit
from the finite substitution alphabet). This is a **positional number system on the
lattice with base A** (a matrix numeration system). The inflation path is the digit
string; the coordinate is its value; computing one from the other is Horner
evaluation. This is why addressing is logarithmic, not linear.

### Logarithmic addressing

A tile at physical distance `D` has a Z⁵ coordinate of magnitude ~`D`, but you reach
it in `k ≈ log_φ(D)` steps, not `D`: inflate `k` levels so your viewport sits in one
small-coordinate supertile, then deflate down following the digits. `O(log distance)`
exact-integer matrix operations. For `D = 10⁵⁰`, ~240 steps, not 10⁵⁰ tiles.

### The recursion, and its one asymmetry

Inflate / move / deflate is recursive to any depth, with the *same* matrix `A` at
every level (self-similarity), and exact at any depth because Z⁵ arithmetic never
drifts. The reach scales: inflate `k` levels and each coarse move strides `φᵏ`
layer-0 tiles.

The asymmetry: **inflation is deterministic, deflation is a choice.** Every tile has
one supertile (`A` is a function, a "carry up"). A supertile has several children, so
coming down you must supply the digit at each level. Inflate-then-deflate returns a
tile *and its siblings*, not the single tile; you pick yours out by the path.

### Multi-scale consistency (the correctness condition)

Moving at a coarse level and then refining yields the *identical* tiling as moving at
the fine level, because it is one self-similar object with a unique supertile grouping
at every scale. This is precisely the property the old de Bruijn viewport-anchor
violated (re-anchoring there produced a different tiling). The Z⁵ / inflation engine
satisfies it by construction.

### What is still unbuilt

The recursion structure is proven; the missing piece is the **exact Z⁵ substitution
alphabet**: the specific child-offset vectors a supertile deflates into, verified to
reproduce a real Penrose tiling tile-for-tile. That is the constructive core, and the
map it realizes (substitution address → de Bruijn coordinate) is the one the 2026
cocycle paper leaves open for the substitution case (see
[05-substitution-and-z5.md](./05-substitution-and-z5.md)).

## Applications (maintainer's thinking)

The addressing model is not specific to a tiling explorer. Its properties map well
onto **procedurally generated, infinite-plane level design** for games:

- **Quick traversal + zoom.** Travel across a vast map cheaply (logarithmic
  addressing, giant φ-strides at coarse levels), then zoom into a specific point and
  generate only the local detail (pruned deflation, bounded per-frame work). No need
  to generate or store the whole world.
- **Layers as portals.** The inflation levels are literal layers. Moving between
  layer N and layer N−1 is a portal, and the path guarantees you know exactly which
  set of fine tiles lives under a given coarse tile. A coarse cell maps to a unique
  set of children across the layer boundary; you can hand a player a portal between
  layers and know the destination set is fixed and consistent.
- **Infinite non-repeating content for free.** The tiling is aperiodic: no two
  regions are identical, so every location is unique level content, deterministically
  fixed by the seed. Variety without authoring, and without repeats.
- **Deterministic, storage-free, networkable.** Same coordinate → same content,
  always. Worlds regenerate from a coordinate rather than being stored, and an exact
  Z⁵ coordinate is a precise shareable / networkable address for a location (good for
  multiplayer consistency and "meet me here" links).
- **Natural level-of-detail.** The hierarchy is the LOD structure: render coarse far
  away, fine up close, guaranteed consistent across the seam because it is one
  self-similar object.

These are leads, not commitments. The func.lol Penrose experiment is the proving
ground for the engine; a game application would be a separate project built on the
same addressing core.
