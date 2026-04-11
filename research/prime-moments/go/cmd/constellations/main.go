// constellations enumerates all biologically-plausible prime family
// constellations and reports the offset patterns that can occur multiple
// times within a human lifetime.
//
// Run from research/prime-moments/go:
//
//	go run ./cmd/constellations
package main

import (
	"fmt"
	"math/big"
	"sort"
	"strings"
)

// Primes within human lifespan, excluding 2.
// 2 is the only even prime, so any constellation containing it has odd
// offsets to every other member and can occur at most once (at base 2).
// For repeatable patterns we use only odd primes.
var primes = []int{3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113}

// Biological constraints based on documented extremes.
const (
	MinParentAgeAtBirth = 18  // age of consent
	MaxMotherAgeAtBirth = 67  // oldest documented mother (IVF)
	MaxFatherAgeAtBirth = 90  // oldest documented father
	MaxLifespan         = 122 // Jeanne Calment
	MinInstances        = 4   // require at least this many lifetime occurrences
)

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

// validChild reports whether childAge is biologically valid for the given
// parent ages, treating pYoung as the (potential) mother.
func validChild(c, pYoung, pOld int) bool {
	youngAge := pYoung - c
	oldAge := pOld - c
	return youngAge >= MinParentAgeAtBirth &&
		youngAge <= MaxMotherAgeAtBirth &&
		oldAge >= MinParentAgeAtBirth &&
		oldAge <= MaxFatherAgeAtBirth
}

func offsetKey(offsets []int) string {
	strs := make([]string, len(offsets))
	for i, o := range offsets {
		strs[i] = fmt.Sprintf("%d", o)
	}
	return strings.Join(strs, ",")
}

// findInstances returns all age snapshots where the given offset pattern
// occurs entirely within MaxLifespan.
func findInstances(offsets []int) [][]int64 {
	maxOff := offsets[len(offsets)-1]
	var instances [][]int64

	for p := int64(3); p+int64(maxOff) <= MaxLifespan; p += 2 {
		allPrime := true
		for _, off := range offsets {
			if !isPrime(p + int64(off)) {
				allPrime = false
				break
			}
		}
		if allPrime {
			ages := make([]int64, len(offsets))
			for i, off := range offsets {
				ages[i] = p + int64(off)
			}
			instances = append(instances, ages)
		}
	}
	return instances
}

func main() {
	seen := make(map[string][]int)

	// Enumerate all parent pairs (allowing same-age parents).
	for i, pYoung := range primes {
		for _, pOld := range primes[i:] {
			var validChildren []int
			for _, c := range primes {
				if c < pYoung && validChild(c, pYoung, pOld) {
					validChildren = append(validChildren, c)
				}
			}

			if len(validChildren) == 0 {
				continue
			}

			// Enumerate all non-empty subsets of children.
			for mask := 1; mask < (1 << len(validChildren)); mask++ {
				var children []int
				for j := 0; j < len(validChildren); j++ {
					if mask&(1<<j) != 0 {
						children = append(children, validChildren[j])
					}
				}

				ages := append([]int{}, children...)
				ages = append(ages, pYoung)
				if pOld != pYoung {
					ages = append(ages, pOld)
				}
				sort.Ints(ages)

				base := ages[0]
				offsets := make([]int, len(ages))
				for i, a := range ages {
					offsets[i] = a - base
				}

				seen[offsetKey(offsets)] = offsets
			}
		}
	}

	type Result struct {
		Offsets   []int
		Instances [][]int64
	}
	var results []Result

	for _, offsets := range seen {
		instances := findInstances(offsets)
		if len(instances) >= MinInstances {
			results = append(results, Result{offsets, instances})
		}
	}

	sort.Slice(results, func(i, j int) bool {
		if len(results[i].Offsets) != len(results[j].Offsets) {
			return len(results[i].Offsets) > len(results[j].Offsets)
		}
		return results[i].Offsets[len(results[i].Offsets)-1] < results[j].Offsets[len(results[j].Offsets)-1]
	})

	fmt.Printf("Prime Family Constellations with %d+ lifetime occurrences\n", MinInstances)
	fmt.Printf("Constraints: parent age at birth [%d-%d] (mother), [%d-%d] (father)\n",
		MinParentAgeAtBirth, MaxMotherAgeAtBirth,
		MinParentAgeAtBirth, MaxFatherAgeAtBirth)
	fmt.Printf("Max lifespan: %d\n", MaxLifespan)
	fmt.Println("==========================================================")

	for _, r := range results {
		fmt.Printf("%v (%d instances)\n", r.Offsets, len(r.Instances))
		for _, ages := range r.Instances {
			fmt.Printf("  %v\n", ages)
		}
	}

	fmt.Println("==========================================================")
	fmt.Printf("Total constellations: %d\n", len(results))
}
