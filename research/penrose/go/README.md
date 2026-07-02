# Pentagrid — Go experiment

A Go port of two TypeScript benchmarks, built to answer two questions:

1. Does Go's `math/big` give meaningfully better BigInt throughput than JS BigInt for full exact enumeration? (Mirrors [`../03-enumeration-cost.ts`](../03-enumeration-cost.ts).)
2. Does Go beat JS on the viewport-anchor pattern, where the hot path is mostly Float64 and only the per-tile BigInt-add scales with anchor magnitude? (Mirrors [`../04-viewport-anchor.ts`](../04-viewport-anchor.ts).)

The TypeScript code in `../` is the explorer's actual runtime. This Go module is a research artifact, kept around because the numbers are informative for two downstream questions: (a) is Go-WASM worth the bundle weight on the client, (b) is server-side tile precomputation feasible as a Go endpoint.

## Layout

```
go.mod
pentagrid.go                    math, init constants, EnumerateExact, MakeAnchor, EnumerateAnchored
cmd/bench/main.go               mirrors 03-enumeration-cost.ts (exact enumeration, varying rects)
cmd/benchanchor/main.go         mirrors 04-viewport-anchor.ts (anchored, varying anchor magnitudes)
```

`pentagrid.go` mirrors the TS oracle in structure: SCALE = 10⁵⁰, `√5` via `big.Int.Sqrt`, cosine and sine derived algebraically, gamma via the same FNV-1a hash. The seed and constants are bit-identical across languages.

## Running

```sh
cd research/penrose/go
go run ./cmd/bench
go run ./cmd/benchanchor
```

## Numbers — exact enumeration (`go run ./cmd/bench`)

```
size     rect    tiles   Go mean   Go p95
small    12×8    381     3.61ms    4.90ms
medium   24×14   1315    10.91ms   11.63ms
large    36×22   3092    24.09ms   25.23ms
x-large  48×30   5583    44.42ms   51.10ms
```

Side-by-side at 1315 tiles:

| backend                            | mean    | p95     | per-tile  |
| ---------------------------------- | ------- | ------- | --------- |
| JS Float64                         | 1.89 ms | 3.11 ms | 1.44 µs   |
| JS viewport-anchor (anchor=0)      | 3.04 ms | 6.04 ms | 2.31 µs   |
| Go viewport-anchor (anchor=0)      | 2.78 ms | 3.43 ms | 2.12 µs   |
| Go math/big (exact)                | 10.91 ms | 11.63 ms | 8.30 µs   |
| JS BigInt (exact)                  | 29.05 ms | 35.64 ms | 22.1 µs   |

## Numbers — viewport anchor (`go run ./cmd/benchanchor`)

```
correctness (anchor=0):  anchored=1315  exact=1315  equal=true

anchor_mag    tiles   mean_ms   p95_ms
0             1315     2.78ms    3.43ms
1e5           1302     3.17ms    4.38ms
1e10          1316     3.02ms    3.49ms
1e20          1306     3.90ms    4.39ms
1e30          1319     4.25ms    4.57ms
1e40          1322     4.89ms    5.23ms

MakeAnchor at |a|=1e20: 3.40 µs/call
```

Side-by-side, viewport-anchor pattern, same workload:

| anchor mag | JS mean | Go mean | Go advantage |
| ---------- | ------- | ------- | ------------ |
| 0          | 3.04 ms | 2.78 ms | 1.09×        |
| 1e10       | 2.87 ms | 3.02 ms | (JS faster)  |
| 1e20       | 5.02 ms | 3.90 ms | 1.29×        |
| 1e30       | 6.30 ms | 4.25 ms | 1.48×        |
| 1e40       | 7.15 ms | 4.89 ms | 1.46×        |

## Interpretation

**Exact enumeration.** Go `math/big` is ~2.7× faster than JS BigInt for the all-BigInt hot path. Real speedup but smaller than folklore suggests — the inner loop is BigInt-bound rather than allocation-bound, and JS BigInt does well at allocation reuse via inline caching. Still ~5.8× slower than JS Float64.

**Viewport anchor.** JS and Go are essentially tied at small anchor magnitudes (Float64 inner loop dominates, both JITs/AOT compile it well). Go pulls ahead by 1.3-1.5× at large anchor magnitudes (≥1e20) because the per-tile BigInt-add for offset→absolute coord conversion is faster in Go. Both stay comfortably under the 16 ms / 60 fps budget at every magnitude tested.

## Implications

**Go-WASM in the client: not worth it.** The anchored pattern already gives 60 fps in pure JS, and the Go advantage at large anchors (1.5×) is irrelevant when JS is already at 7 ms. Add WASM's typical 1.5-2× slowdown vs native Go, ~500 KB tinygo bundle, and the cross-language toolchain cost, and the math doesn't add up.

**Go for server-side precomputation: still the right tool if we ever ship it.** A 3000-tile region renders in ~24 ms native Go (exact, no anchor). A Vercel function returning precomputed tile geometry for landing-page illustrations is a clean win: zero client-side math, CDN-cacheable JSON, exact addressing baked in. The interactive explorer still wants client-side enumeration for tactile pan/zoom, but static illustrations don't need the same architecture.

**The viewport-anchor pattern wins regardless of language.** Whatever runtime we pick, the architecture (`BigInt truth, Float64 view`) is what makes 60 fps + exact-at-any-size possible. The 1.5× language gap at large anchors doesn't change the design.

## Citation

If the maintainer ever decides to add a server-side precompute endpoint for landing illustrations, the Go pentagrid in `pentagrid.go` is the seed of that work — port `EnumerateExact` to a tile-geometry exporter, wrap in a Vercel function, ship a static `tiles.json` artifact.
