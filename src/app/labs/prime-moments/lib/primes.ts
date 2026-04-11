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
