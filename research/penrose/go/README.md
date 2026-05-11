# Pentagrid — Go experiment

A Go port of the BigInt-exact pentagrid enumerator from [`../03-enumeration-cost.ts`](../03-enumeration-cost.ts), built to answer one question: does Go's `math/big` give meaningfully better BigInt throughput than JS BigInt for the same workload?

The TypeScript code in `../` is the explorer's actual runtime. This Go module is an experiment, kept around because the numbers are informative for two future questions: (1) is Go-WASM worth the bundle weight on the client, (2) is server-side tile precomputation feasible as a Go endpoint.

## Layout

```
go.mod
pentagrid.go              the math, init constants, EnumerateExact
cmd/bench/main.go         same 50-iteration loop as 03-enumeration-cost.ts
```

`pentagrid.go` mirrors the TS oracle in structure: SCALE = 10⁵⁰, `√5` via `big.Int.Sqrt`, cosine and sine derived algebraically, gamma via the same FNV-1a hash. The seed and constants are bit-identical across languages.

## Running

```sh
cd research/penrose/go
go run ./cmd/bench
```

## Numbers

```
size     rect    tiles   Go mean   Go p95
small    12×8    381     3.61ms    4.90ms
medium   24×14   1315    10.91ms   11.63ms
large    36×22   3092    24.09ms   25.23ms
x-large  48×30   5583    44.42ms   51.10ms
```

Side-by-side at 1315 tiles (the budget-target row from [`../03-enumeration-cost.md`](../03-enumeration-cost.md)):

| backend                            | mean    | p95     | per-tile  |
| ---------------------------------- | ------- | ------- | --------- |
| JS Float64                         | 1.89 ms | 3.11 ms | 1.44 µs   |
| JS viewport-anchor (anchor=0)      | 3.04 ms | 6.04 ms | 2.31 µs   |
| Go math/big                        | 10.91 ms | 11.63 ms | 8.30 µs   |
| JS BigInt                          | 29.05 ms | 35.64 ms | 22.1 µs   |

## Interpretation

- Go `math/big` is **~2.7× faster** than JS BigInt for this workload. Real speedup, smaller than the 5-10× folklore suggests, because the inner loop is BigInt-bound rather than allocation-bound (and JS BigInt does well at allocation reuse via inline caching).
- Go is **~5.8× slower** than JS Float64. Even native Go can't catch up to JIT-compiled Float64.
- Go is **~3.6× slower** than the JS viewport-anchor pattern. The anchor pattern wins because most of its math is Float64; only the per-tile absolute-coord conversion needs BigInt.

## Implications

**Go-WASM in the client: probably not worth it.** WASM-from-Go typically runs 1.5-2× slower than native Go (cold compilation, no go-routine scheduler, GC differences), so 1315-tile enumeration would be ~16-22 ms in the browser. That's exactly at the 16 ms / 60 fps budget edge for the target row, and over budget at larger viewports. Add the ~500 KB tinygo bundle and the cross-language complexity, and the viewport-anchor pattern (3 ms in pure JS) is plainly the better answer.

**Go for server-side precomputation: useful.** A 3000-tile region renders in ~24 ms in native Go. A Vercel function returning precomputed tile geometry for the landing-page illustrations is a clean win: zero client-side math, CDN-cacheable JSON, exact addressing baked in. The interactive explorer still wants client-side enumeration for tactile pan/zoom, but static illustrations don't need the same architecture.

## Citation

If the maintainer ever decides to add a server-side precompute endpoint for landing illustrations, the Go pentagrid in `pentagrid.go` is the seed of that work — port `EnumerateExact` to a tile-geometry exporter, wrap in a Vercel function, ship a static `tiles.json` artifact.
