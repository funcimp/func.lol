// URL serialization for the explorer's share link. A tile is the rhombus
// [n; j, k]: its base-corner ℤ⁵ coordinate (five small signed integers) plus the
// two varying axes. Encoding the corner alone is ambiguous because many rhombi
// share an n, so the address is all seven integers. The camera adds seed and
// zoom. Every parser returns null on bad input. The caller treats null as
// "ignore this param, use the default," never an error. Decimal encoding keeps
// signs trivial and is the v2 seam (widen here when coords become BigInt).

export type TileAddress = { coord: readonly number[]; j: number; k: number };

export function encodeTile(t: TileAddress): string {
  return [...t.coord, t.j, t.k].join(".");
}

export function decodeTile(
  raw: string | string[] | undefined,
): TileAddress | null {
  if (typeof raw !== "string") return null;
  const parts = raw.split(".");
  if (parts.length !== 7) return null;
  if (parts.some((s) => s.trim() === "")) return null;
  const nums = parts.map((s) => Number(s));
  if (nums.some((n) => !Number.isInteger(n))) return null;
  const coord = nums.slice(0, 5);
  if (coord.some((n) => Math.abs(n) > 100000)) return null;
  const j = nums[5], k = nums[6];
  if (!(j >= 0 && j < k && k <= 4)) return null;
  return { coord, j, k };
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
