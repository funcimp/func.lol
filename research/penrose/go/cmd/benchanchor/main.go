// Command benchanchor mirrors research/penrose/04-viewport-anchor.ts in
// Go. Tests the BigInt-truth / Float64-view pattern at anchor magnitudes
// 0, 1e5, 1e10, 1e20, 1e30, 1e40 and reports throughput per row.
//
// Run from research/penrose/go:
//
//	go run ./cmd/benchanchor
package main

import (
	"fmt"
	"math/big"
	"sort"
	"time"

	"github.com/funcimp/func.lol/research/penrose"
)

func main() {
	gamma, _ := pentagrid.GammaFromSeed("funclol")
	rect := pentagrid.Rect{X0: -12, Y0: -7, X1: 12, Y1: 7}

	// Correctness sanity: anchor=(0,0) anchored count should equal
	// the BigInt-exact enumerator's count on the same rect.
	zero := big.NewInt(0)
	anchor0 := pentagrid.MakeAnchor(zero, zero, gamma)
	anchoredCount := pentagrid.EnumerateAnchored(anchor0, rect)
	exactCount := pentagrid.EnumerateExact(gamma, rect)
	fmt.Printf("seed=funclol  rect=24×14\n\n")
	fmt.Printf("correctness (anchor=0):  anchored=%d  exact=%d  equal=%t\n\n",
		anchoredCount, exactCount, anchoredCount == exactCount)

	// Throughput vs anchor magnitude.
	fmt.Println("anchor_mag    tiles   mean_ms   p95_ms")
	fmt.Println("------------  ------  --------  --------")

	mags := []int{0, 5, 10, 20, 30, 40}
	for _, exp := range mags {
		var ax, ay *big.Int
		if exp == 0 {
			ax = big.NewInt(0)
			ay = big.NewInt(0)
		} else {
			ten := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(exp)), nil)
			ax = new(big.Int).Mul(ten, pentagrid.Scale)
			ay = new(big.Int).Mul(ten, pentagrid.Scale)
		}
		anchor := pentagrid.MakeAnchor(ax, ay, gamma)

		// Warmup.
		for i := 0; i < 5; i++ {
			pentagrid.EnumerateAnchored(anchor, rect)
		}

		const N = 50
		const p95Idx = N * 95 / 100
		times := make([]float64, 0, N)
		var count int
		for i := 0; i < N; i++ {
			t0 := time.Now()
			count = pentagrid.EnumerateAnchored(anchor, rect)
			times = append(times, float64(time.Since(t0).Nanoseconds())/1e6)
		}
		sort.Float64s(times)
		var sum float64
		for _, t := range times {
			sum += t
		}
		mean := sum / float64(N)
		p95 := times[p95Idx]
		var label string
		if exp == 0 {
			label = "0"
		} else {
			label = fmt.Sprintf("1e%d", exp)
		}
		fmt.Printf("%-12s  %-6d  %5.2fms   %5.2fms\n", label, count, mean, p95)
	}

	// MakeAnchor cost at large magnitude (mirrors JS Q4).
	const NA = 10_000
	tenE20 := new(big.Int).Exp(big.NewInt(10), big.NewInt(20), nil)
	ax := new(big.Int).Mul(tenE20, pentagrid.Scale)
	ay := new(big.Int).Mul(tenE20, pentagrid.Scale)
	t0 := time.Now()
	for i := 0; i < NA; i++ {
		pentagrid.MakeAnchor(ax, ay, gamma)
	}
	dt := float64(time.Since(t0).Nanoseconds()) / 1e3 / float64(NA)
	fmt.Printf("\nMakeAnchor at |a|=1e20:  %.2f µs/call\n", dt)
}
