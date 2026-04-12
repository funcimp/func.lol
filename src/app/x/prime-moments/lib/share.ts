// Share encoding for Prime Moments constellations.
//
// Pure syntactic helpers — no dependency on primality or admissibility.
// The caller is responsible for the admissibility check after parsing.

const MAX_LIFESPAN = 120;

/**
 * Serialize a constellation's offsets as a share-URL-friendly string.
 * Dot-separated so no characters need URL-encoding. Example: "0.30.32".
 */
export function encodeShareParam(offsets: number[]): string {
  return offsets.join(".");
}

/**
 * Parse a raw share-URL query value into a validated offsets array.
 * Returns null for any invalid input — the caller should treat null as
 * "fall through to the normal page" and render no error.
 *
 * Validation rules:
 * - Must be a non-empty string (not undefined, not string[]).
 * - Parts after dot-splitting must all be integers.
 * - Integers must be in [0, MAX_LIFESPAN].
 * - The array must start with 0 (canonical form, offsets are relative
 *   to the youngest member).
 * - The array must be strictly ascending.
 *
 * Multi-constellation extension: anything after the first ";" is
 * ignored. MVP never emits these but the parser is forward-compatible.
 */
export function parseShareParam(
  raw: string | string[] | undefined,
): number[] | null {
  if (typeof raw !== "string") return null;
  if (raw.trim() === "") return null;

  const firstConstellation = raw.split(";")[0];
  const parts = firstConstellation.split(".").map((s) => s.trim());
  const offsets = parts.map((s) => Number(s));

  if (
    offsets.some(
      (n) => !Number.isInteger(n) || n < 0 || n > MAX_LIFESPAN,
    )
  ) {
    return null;
  }
  if (offsets[0] !== 0) return null;
  for (let i = 1; i < offsets.length; i++) {
    if (offsets[i] <= offsets[i - 1]) return null;
  }
  return offsets;
}
