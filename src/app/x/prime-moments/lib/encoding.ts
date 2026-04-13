// Prime constellation bitmask encoding.
//
// Each constellation is encoded as a uint32 bitmask over the 29 odd primes
// ≤ 113. Bit i is set if the prime at index i participates in the
// constellation's first lifetime instance. The bitmask is then base62-encoded
// for compact URLs and data files.
//
// Decode: base62 string → uint32 → set bits → prime ages → offsets.

const PRIMES = [
  3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
  73, 79, 83, 89, 97, 101, 103, 107, 109, 113,
] as const;

const PRIME_TO_INDEX = new Map<number, number>();
for (let i = 0; i < PRIMES.length; i++) {
  PRIME_TO_INDEX.set(PRIMES[i], i);
}

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE = 62;

/**
 * Encode a non-negative integer as a base62 string.
 */
export function toBase62(n: number): string {
  if (n === 0) return "0";
  let s = "";
  while (n > 0) {
    s = BASE62[n % BASE] + s;
    n = Math.floor(n / BASE);
  }
  return s;
}

/**
 * Decode a base62 string to a non-negative integer.
 * Returns -1 for invalid input.
 */
export function fromBase62(s: string): number {
  let n = 0;
  for (const ch of s) {
    const v = BASE62.indexOf(ch);
    if (v === -1) return -1;
    n = n * BASE + v;
  }
  return n;
}

/**
 * Encode a constellation's first-instance ages as a base62 bitmask string.
 */
export function agesToBitmask(ages: number[]): number {
  let mask = 0;
  for (const age of ages) {
    const idx = PRIME_TO_INDEX.get(age);
    if (idx === undefined) return 0;
    mask |= 1 << idx;
  }
  return mask;
}

/**
 * Decode a bitmask to the sorted list of prime ages.
 */
export function bitmaskToAges(mask: number): number[] {
  const ages: number[] = [];
  for (let i = 0; i < PRIMES.length; i++) {
    if (mask & (1 << i)) {
      ages.push(PRIMES[i]);
    }
  }
  return ages;
}

/**
 * Convert prime ages to constellation offsets (sorted, relative to smallest).
 */
export function agesToOffsets(ages: number[]): number[] {
  const sorted = [...ages].sort((a, b) => a - b);
  const base = sorted[0];
  return sorted.map((a) => a - base);
}

/**
 * Full decode: base62 string → offsets.
 * Returns null for invalid input.
 */
export function decodeConstellation(s: string): number[] | null {
  const mask = fromBase62(s);
  if (mask <= 0) return null;
  const ages = bitmaskToAges(mask);
  if (ages.length < 2) return null;
  return agesToOffsets(ages);
}

/**
 * Full encode: offsets → base62 string.
 * Uses findLifetimeInstances logic inline to get the first instance,
 * then encodes that as a bitmask.
 */
export function encodeConstellation(offsets: number[]): string | null {
  // Find the first all-prime instance (smallest odd base prime).
  const maxOff = offsets[offsets.length - 1];
  for (let p = 3; p + maxOff <= 120; p += 2) {
    const ages = offsets.map((o) => o + p);
    if (ages.every((a) => PRIME_TO_INDEX.has(a))) {
      return toBase62(agesToBitmask(ages));
    }
  }
  return null;
}
