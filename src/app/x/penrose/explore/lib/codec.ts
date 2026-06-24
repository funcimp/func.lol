// URL serialization for the explorer's share link. The tile address is the ℤ⁵
// coordinate (five small signed integers); the camera adds seed and zoom. Every
// parser returns null on bad input. The caller treats null as "ignore this
// param, use the default," never an error. Decimal encoding keeps signs trivial
// and is the v2 seam (widen here when addresses become BigInt).

export function encodeAddress(coord: readonly number[]): string {
  return coord.join(".");
}

export function decodeAddress(
  raw: string | string[] | undefined,
): number[] | null {
  if (typeof raw !== "string") return null;
  if (raw.trim() === "") return null;
  const parts = raw.split(".");
  if (parts.length !== 5) return null;
  const coord = parts.map((s) => Number(s));
  if (coord.some((n) => !Number.isInteger(n) || Math.abs(n) > 100000)) {
    return null;
  }
  return coord;
}

export function parseSeed(raw: string | string[] | undefined): string | null {
  if (typeof raw !== "string") return null;
  return /^[A-Za-z0-9_-]{1,32}$/.test(raw) ? raw : null;
}

export function parseZoom(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string") return null;
  const z = Number(raw);
  if (!Number.isFinite(z)) return null;
  return Math.min(Math.max(z, 4), 800);
}
