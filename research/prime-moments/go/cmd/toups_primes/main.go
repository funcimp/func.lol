// toups_primes finds Toups Primes — triples (p, p+30, p+32) where all
// three are prime. Named after the family whose ages (11, 41, 43)
// inspired the prime-moments exploration.
//
// Run from research/prime-moments/go:
//
//	go run ./cmd/toups_primes
package main

import (
	"fmt"
	"math/big"
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

func main() {
	limit := int64(10_000)
	count := 0

	fmt.Println("Toups Primes (p, p+30, p+32) under", limit)
	fmt.Println("==========================================")

	for p := int64(3); p+32 <= limit; p += 2 {
		if isPrime(p) && isPrime(p+30) && isPrime(p+32) {
			fmt.Printf("(%d, %d, %d)\n", p, p+30, p+32)
			count++
		}
	}

	fmt.Println("==========================================")
	fmt.Printf("Total: %d Toups Prime triples\n", count)
}
