# Penrose — Research

The pre-implementation exercises behind the [Penrose experiment](../../src/app/x/penrose/). Three substrate-level questions answered with small Bun scripts before any explorer code lands. Each answers one decision the shipped `lib/` would otherwise have to guess.

The pattern mirrors [`research/prime-moments`](../prime-moments/) and [`research/tripwire`](../tripwire/): public, sitemap-omitted, README + scripts + short findings.

## Origin

Penrose's P3 (thick + thin rhombi) tiles the plane aperiodically. The de Bruijn pentagrid construction lets us address any tile by an integer 5-tuple `(k0, k1, k2, k3, k4)` and answer `point → tile` in O(1). The shipped experiment is an infinite-canvas explorer of that tiling.

Before writing the explorer, three things need numbers, not guesses:

1. **Coord element type.** Is Float64 precise enough to make `floor(p · e_j + γ_j)` stable across the explorer's reachable zoom range, or do we need BigInt?
2. **URL share-link codec.** Is the prime-moments base62 pattern actually the most compact for our state, or does base64url win for our integer ranges?
3. **Enumeration cost.** Does the de Bruijn enumeration hit the <4ms-at-1500-tiles budget unaided, or do we need to optimize before shipping?

Each script writes its numbers to stdout. The sibling `.md` writeups summarize.

## The three questions

| # | Question                                | Script                                                            | Findings                                                                |
| - | --------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1 | Coord representation: Float64 vs BigInt | [`01-coord-representation.ts`](./01-coord-representation.ts) | [`01-coord-representation.md`](./01-coord-representation.md) |
| 2 | URL coord encoding: base62 vs others    | [`02-url-encoding.ts`](./02-url-encoding.ts)                 | [`02-url-encoding.md`](./02-url-encoding.md)                 |
| 3 | Enumeration cost: <4ms at 1500 tiles    | [`03-enumeration-cost.ts`](./03-enumeration-cost.ts)         | [`03-enumeration-cost.md`](./03-enumeration-cost.md)         |

## Pentagrid in one paragraph

Five unit vectors `e_j = (cos(2πj/5), sin(2πj/5))` for `j ∈ {0..4}`. A seed-derived phase `γ_j` per direction, normalized so `Σ γ_j = 0`. For any world point `p`, the pentagrid coord is `(floor(p · e_j + γ_j))` for `j ∈ {0..4}`. Two tiles share an edge iff their coords differ by one in a single index. The de Bruijn construction maps each pentagrid coord to a P3 rhombus tile in the Penrose tiling. That's the whole address space.

## Running

```sh
bun run research/penrose/01-coord-representation.ts
bun run research/penrose/02-url-encoding.ts
bun run research/penrose/03-enumeration-cost.ts
```

Each script is self-contained. Numbers in the `.md` writeups are captured from a single run on the maintainer's machine; rerun to refresh.

## What this folder is not

No implementation code. No shared helpers with `src/app/x/penrose/lib/`. A little duplication keeps each script honest. The shipped `lib/` cites these writeups in one-line comments where the decision matters.

## References

- N. G. de Bruijn, *Algebraic theory of Penrose's non-periodic tilings of the plane* (1981).
- Roger Penrose's original P3 (kites & darts → thick & thin rhombi).
- Tony Smith's notes on the pentagrid → rhombus mapping.
