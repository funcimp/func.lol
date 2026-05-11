// Command bench mirrors the structure of research/penrose/03-enumeration-cost.ts
// in Go. Same seed, same rect sizes, same 50-iteration loop. The point is to
// see whether Go's math/big is meaningfully faster than JS BigInt for the
// pentagrid enumeration hot path.
//
// Run from research/penrose/go:
//
//	go run ./cmd/bench
package main

import (
	"fmt"
	"sort"
	"time"

	"github.com/funcimp/func.lol/research/penrose"
)

type row struct {
	name string
	rect pentagrid.Rect
}

func main() {
	rows := []row{
		{"small", pentagrid.Rect{X0: -6, Y0: -4, X1: 6, Y1: 4}},
		{"medium", pentagrid.Rect{X0: -12, Y0: -7, X1: 12, Y1: 7}},
		{"large", pentagrid.Rect{X0: -18, Y0: -11, X1: 18, Y1: 11}},
		{"x-large", pentagrid.Rect{X0: -24, Y0: -15, X1: 24, Y1: 15}},
	}

	gamma, _ := pentagrid.GammaFromSeed("funclol")

	// Warm up.
	for i := 0; i < 3; i++ {
		pentagrid.EnumerateExact(gamma, rows[1].rect)
	}

	fmt.Println("seed=funclol  scale=10^50  (Go math/big)")
	fmt.Println()
	fmt.Println("size     rect      tiles   mean_ms   p95_ms")
	fmt.Println("-------  --------  ------  --------  --------")

	const N = 50
	const p95Idx = N * 95 / 100
	for _, r := range rows {
		times := make([]float64, 0, N)
		var count int
		for i := 0; i < N; i++ {
			t0 := time.Now()
			count = pentagrid.EnumerateExact(gamma, r.rect)
			times = append(times, float64(time.Since(t0).Nanoseconds())/1e6)
		}
		sort.Float64s(times)
		var sum float64
		for _, t := range times {
			sum += t
		}
		mean := sum / float64(N)
		p95 := times[p95Idx]
		w := r.rect.X1 - r.rect.X0
		h := r.rect.Y1 - r.rect.Y0
		fmt.Printf("%-7s  %-8s  %-6d  %5.2fms   %5.2fms\n",
			r.name, fmt.Sprintf("%dx%d", w, h), count, mean, p95)
	}
}
