// Primality utilities.
// Trial division up to sqrt(n). Fast enough for ages well past 122; the
// finder never asks about anything larger than maxLifespan.

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

// Sieve of Eratosthenes. Used by tests; cheap up to small n.
export function primesUpTo(n: number): number[] {
  if (n < 2) return [];
  const sieve = new Array<boolean>(n + 1).fill(true);
  sieve[0] = false;
  sieve[1] = false;
  for (let i = 2; i * i <= n; i++) {
    if (sieve[i]) {
      for (let j = i * i; j <= n; j += i) sieve[j] = false;
    }
  }
  const out: number[] = [];
  for (let i = 2; i <= n; i++) if (sieve[i]) out.push(i);
  return out;
}

/**
 * Whether a constellation pattern could have more than one all-prime
 * solution in principle — i.e., it's admissible in the Hardy–Littlewood
 * sense. A pattern is admissible iff, for every prime q ≤ k (where k is
 * the tuple length), the offsets mod q do not cover all residues
 * {0, 1, ..., q-1}. If they did, every base p would hit a residue that
 * makes some p+offset divisible by q, meaning at most one base could
 * produce an all-prime tuple.
 *
 * Examples:
 * - [0, 10] is admissible: offsets mod 2 = {0}, doesn't cover {0,1}.
 * - [0, 11] is NOT: offsets mod 2 = {0, 1}, covers all of {0, 1}.
 *   The only all-prime instance is (2, 13) via the base-2 escape.
 * - [0, 2, 4] is NOT: offsets mod 3 = {0, 1, 2}, covers all of {0,1,2}.
 *   The only all-prime instance is (3, 5, 7).
 * - [0, 30, 32] is admissible: mod 2 = {0}, mod 3 = {0, 0, 2}. Good.
 *
 * Primes q > k don't need checking — the tuple has at most k < q
 * distinct residues, so it can't cover all q residues.
 */
export function isAdmissibleConstellation(offsets: number[]): boolean {
  const k = offsets.length;
  for (const q of primesUpTo(k)) {
    const residues = new Set(offsets.map((o) => ((o % q) + q) % q));
    if (residues.size === q) return false;
  }
  return true;
}
