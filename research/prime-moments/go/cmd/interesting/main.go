// interesting enumerates all admissible prime constellations of size 2..6
// with offsets ≤ 120, counts their lifetime instances, and outputs each
// one as a 4-byte little-endian uint32 bitmask.
//
// The bitmask encodes the first lifetime instance as set bits over the
// 29 odd primes [3, 5, 7, 11, ..., 113]. The client decodes the bitmask
// to recover offsets, instances, and all derived properties.
//
// Run from research/prime-moments/go:
//
//	go run ./cmd/interesting > constellations.bin
package main

import (
	"encoding/binary"
	"fmt"
	"math/big"
	"os"
	"sort"
)

const maxOffset = 120

var primes = []int{3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113}

var primeIndex = make(map[int]int)

func init() {
	for i, p := range primes {
		primeIndex[p] = i
	}
}


var primeCache = make(map[int64]bool)

func isPrime(n int64) bool {
	if n < 2 {
		return false
	}
	if result, ok := primeCache[n]; ok {
		return result
	}
	result := big.NewInt(n).ProbablyPrime(20)
	primeCache[n] = result
	return result
}

func oddPrimesUpTo(n int) []int {
	var ps []int
	for i := 3; i <= n; i += 2 {
		if isPrime(int64(i)) {
			ps = append(ps, i)
		}
	}
	return ps
}

func isAdmissible(offsets []int) bool {
	k := len(offsets)
	for _, q := range oddPrimesUpTo(k) {
		residues := make(map[int]bool)
		for _, o := range offsets {
			residues[((o%q)+q)%q] = true
		}
		if len(residues) == q {
			return false
		}
	}
	return true
}

type result struct {
	offsets []int
	first   []int // first instance ages
	count   int   // number of instances
	bitmask uint32
}

func findInstances(offsets []int) ([][]int, int) {
	maxOff := offsets[len(offsets)-1]
	var instances [][]int
	for p := 3; p+maxOff <= maxOffset; p += 2 {
		allPrime := true
		for _, off := range offsets {
			if !isPrime(int64(p + off)) {
				allPrime = false
				break
			}
		}
		if allPrime {
			ages := make([]int, len(offsets))
			for i, off := range offsets {
				ages[i] = p + off
			}
			instances = append(instances, ages)
		}
	}
	return instances, len(instances)
}

func agesToBitmask(ages []int) uint32 {
	var mask uint32
	for _, age := range ages {
		if idx, ok := primeIndex[age]; ok {
			mask |= 1 << idx
		}
	}
	return mask
}

func enumerate(k, maxOff int) [][]int {
	var results [][]int
	var recurse func(start, depth int, current []int)
	recurse = func(start, depth int, current []int) {
		if depth == 0 {
			result := make([]int, len(current))
			copy(result, current)
			results = append(results, result)
			return
		}
		for v := start; v <= maxOff; v++ {
			recurse(v+1, depth-1, append(current, v))
		}
	}
	recurse(1, k-1, []int{0})
	return results
}

func main() {
	var all []result

	for k := 2; k <= 6; k++ {
		candidates := enumerate(k, maxOffset)
		fmt.Fprintf(os.Stderr, "k=%d: %d candidates\n", k, len(candidates))

		count := 0
		for _, offsets := range candidates {
			if !isAdmissible(offsets) {
				continue
			}
			instances, n := findInstances(offsets)
			if n < 2 {
				continue
			}
			all = append(all, result{
				offsets: offsets,
				first:   instances[0],
				count:   n,
				bitmask: agesToBitmask(instances[0]),
			})
			count++
		}
		fmt.Fprintf(os.Stderr, "k=%d: %d admissible with 2+ instances\n", k, count)
	}

	// Sort by size ascending, then instance count descending.
	sort.Slice(all, func(i, j int) bool {
		if len(all[i].offsets) != len(all[j].offsets) {
			return len(all[i].offsets) < len(all[j].offsets)
		}
		return all[i].count > all[j].count
	})

	fmt.Fprintf(os.Stderr, "total: %d constellations\n", len(all))

	var buf [4]byte
	for _, r := range all {
		binary.LittleEndian.PutUint32(buf[:], r.bitmask)
		if _, err := os.Stdout.Write(buf[:]); err != nil {
			fmt.Fprintf(os.Stderr, "write error: %v\n", err)
			os.Exit(1)
		}
	}
}
