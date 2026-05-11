// De Bruijn pentagrid math for the Penrose explorer.
//
// Design constraint per research/penrose/01-coord-representation.md:
// addressing is exact at any size. Coord is a BigInt 5-tuple. The
// render hot path uses the viewport-anchor pattern from
// research/penrose/04-viewport-anchor.md — a BigInt anchor exposes
// precomputed nProj (exact integer projection) and fProj (Float64
// fractional remainder), and per-frame enumeration runs Float64 with
// γ_eff = fProj. Absolute coords are anchor.nProj + the Float64-derived
// offset coord.

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const FOUR = BigInt(4);
const FIVE = BigInt(5);
const TEN = BigInt(10);
const TWO_POW_32 = BigInt(1) << BigInt(32);
const HALF_SCALE_EXP = BigInt(50);
const SCALE = TEN ** HALF_SCALE_EXP;
const SCALE_F = Number(SCALE);
const SCALE2 = SCALE * SCALE;

function bigintSqrt(n: bigint): bigint {
  if (n < ZERO) throw new Error("negative");
  if (n < TWO) return n;
  let x = n;
  let y = (x + ONE) / TWO;
  while (y < x) {
    x = y;
    y = (x + n / x) / TWO;
  }
  return x;
}

function bigintFloorDiv(n: bigint, d: bigint): bigint {
  if (d === ZERO) throw new Error("div by zero");
  if (d < ZERO) {
    n = -n;
    d = -d;
  }
  if (n >= ZERO) return n / d;
  return n % d === ZERO ? n / d : n / d - ONE;
}

// Algebraic constants. cos(2π/5) = (√5 - 1)/4, sin(2π/5) = √(10+2√5)/4.
const SQRT5 = bigintSqrt(FIVE * SCALE2);
const SQRT_T_PLUS = bigintSqrt((TEN * SCALE + TWO * SQRT5) * SCALE);
const SQRT_T_MINUS = bigintSqrt((TEN * SCALE - TWO * SQRT5) * SCALE);

const COS_HI: readonly bigint[] = [
  SCALE,
  bigintFloorDiv(SQRT5 - SCALE, FOUR),
  bigintFloorDiv(-(SQRT5 + SCALE), FOUR),
  bigintFloorDiv(-(SQRT5 + SCALE), FOUR),
  bigintFloorDiv(SQRT5 - SCALE, FOUR),
];
const SIN_HI: readonly bigint[] = [
  ZERO,
  bigintFloorDiv(SQRT_T_PLUS, FOUR),
  bigintFloorDiv(SQRT_T_MINUS, FOUR),
  bigintFloorDiv(-SQRT_T_MINUS, FOUR),
  bigintFloorDiv(-SQRT_T_PLUS, FOUR),
];

export const COS_F: readonly number[] = COS_HI.map((c) => Number(c) / SCALE_F);
export const SIN_F: readonly number[] = SIN_HI.map((s) => Number(s) / SCALE_F);

export type Coord = readonly [bigint, bigint, bigint, bigint, bigint];
export type Vec2 = readonly [number, number];
export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type TileType = "thick" | "thin";

export type Tile = {
  coord: Coord;
  type: TileType;
  // Vertices in offset coords (relative to anchor). Small Float64.
  vertices: readonly [Vec2, Vec2, Vec2, Vec2];
};

export type Anchor = {
  x: bigint;
  y: bigint;
  nProj: readonly [bigint, bigint, bigint, bigint, bigint];
  fProj: readonly [number, number, number, number, number];
};

// FNV-1a-ish seed → 5 BigInt gammas summing to ~0 (modulo 5).
export function gammaFromSeed(seed: string): {
  exact: readonly [bigint, bigint, bigint, bigint, bigint];
  float: readonly [number, number, number, number, number];
} {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const raw: bigint[] = [];
  for (let i = 0; i < 5; i++) {
    h = Math.imul(h ^ (i + 1), 16777619) >>> 0;
    raw.push((BigInt(h) * SCALE) / TWO_POW_32 - SCALE / TWO);
  }
  const sum = raw.reduce((a, b) => a + b, ZERO);
  const shift = sum / FIVE;
  const exact = raw.map((g) => g - shift) as unknown as readonly [bigint, bigint, bigint, bigint, bigint];
  const float = exact.map((g) => Number(g) / SCALE_F) as unknown as readonly [number, number, number, number, number];
  return { exact, float };
}

export function makeAnchor(
  x: bigint,
  y: bigint,
  gammaBig: readonly bigint[],
): Anchor {
  const nProj: bigint[] = new Array(5);
  const fProj: number[] = new Array(5);
  for (let j = 0; j < 5; j++) {
    const proj = x * COS_HI[j] + y * SIN_HI[j] + gammaBig[j] * SCALE;
    const n = bigintFloorDiv(proj, SCALE2);
    nProj[j] = n;
    const remainder = proj - n * SCALE2;
    fProj[j] = Number(remainder) / Number(SCALE2);
  }
  return {
    x,
    y,
    nProj: nProj as unknown as Anchor["nProj"],
    fProj: fProj as unknown as Anchor["fProj"],
  };
}

// Absolute pentagrid coord of a world point. Used for hover when the
// cursor is converted to a BigInt world position via anchor + offset.
export function pointToCoordExact(
  px: bigint,
  py: bigint,
  gammaBig: readonly bigint[],
): Coord {
  const c: bigint[] = new Array(5);
  for (let j = 0; j < 5; j++) {
    const proj = px * COS_HI[j] + py * SIN_HI[j] + gammaBig[j] * SCALE;
    c[j] = bigintFloorDiv(proj, SCALE2);
  }
  return c as unknown as Coord;
}

// Anchor-aware point→coord. The cursor's offset from the anchor is a
// small Float64 vector; we add anchor.fProj to get the projection's
// fractional part in [0,1+δ) and floor to get the offset integer, then
// add anchor.nProj for the absolute BigInt result.
export function pointToCoordAnchored(
  anchor: Anchor,
  offset: Vec2,
): Coord {
  const c: bigint[] = new Array(5);
  for (let j = 0; j < 5; j++) {
    const localProj = anchor.fProj[j] + offset[0] * COS_F[j] + offset[1] * SIN_F[j];
    const offsetN = Math.floor(localProj);
    c[j] = anchor.nProj[j] + BigInt(offsetN);
  }
  return c as unknown as Coord;
}

// Enumerate rhombi whose pentagrid cell intersects the offset-relative
// rect. Returns each tile with its 4 vertices in offset coords (small
// Float64) and its absolute BigInt coord.
//
// Tile shape: bounded by 4 pentagrid lines, two from family j and two
// from family k. The 4 vertices are line-pair intersections, computed
// in Float64. Tile type: k-j mod 5 ∈ {1, 4} → thick; ∈ {2, 3} → thin.
export function enumerateTiles(anchor: Anchor, rect: Rect): Tile[] {
  const tiles: Tile[] = [];
  const gamma = anchor.fProj;
  const seen = new Set<string>();
  for (let j = 0; j < 4; j++) {
    for (let k = j + 1; k < 5; k++) {
      const ejx = COS_F[j], ejy = SIN_F[j];
      const ekx = COS_F[k], eky = SIN_F[k];
      const det = ejx * eky - ejy * ekx;
      if (Math.abs(det) < 1e-12) continue;
      const invDet = 1 / det;
      // Step vectors for moving to adjacent line-pair intersections.
      const dxJ = eky * invDet, dyJ = -ekx * invDet;
      const dxK = -ejy * invDet, dyK = ejx * invDet;
      // Line-index bounds derived from rect corner projections.
      const pj0 = rect.x0 * ejx + rect.y0 * ejy;
      const pj1 = rect.x1 * ejx + rect.y0 * ejy;
      const pj2 = rect.x0 * ejx + rect.y1 * ejy;
      const pj3 = rect.x1 * ejx + rect.y1 * ejy;
      const pk0 = rect.x0 * ekx + rect.y0 * eky;
      const pk1 = rect.x1 * ekx + rect.y0 * eky;
      const pk2 = rect.x0 * ekx + rect.y1 * eky;
      const pk3 = rect.x1 * ekx + rect.y1 * eky;
      const kjMin = Math.floor(Math.min(pj0, pj1, pj2, pj3) + gamma[j]) - 1;
      const kjMax = Math.ceil(Math.max(pj0, pj1, pj2, pj3) + gamma[j]) + 1;
      const kkMin = Math.floor(Math.min(pk0, pk1, pk2, pk3) + gamma[k]) - 1;
      const kkMax = Math.ceil(Math.max(pk0, pk1, pk2, pk3) + gamma[k]) + 1;
      const type: TileType = k - j === 1 || k - j === 4 ? "thick" : "thin";
      for (let kj = kjMin; kj <= kjMax; kj++) {
        const aj = kj - gamma[j];
        for (let kk = kkMin; kk <= kkMax; kk++) {
          const ak = kk - gamma[k];
          const px = (eky * aj - ejy * ak) * invDet;
          const py = (-ekx * aj + ejx * ak) * invDet;
          if (px < rect.x0 || px > rect.x1 || py < rect.y0 || py > rect.y1) continue;
          // Offset coords (small integers) for the 5-tuple.
          const o0 = j === 0 ? kj : k === 0 ? kk : Math.floor(px * COS_F[0] + py * SIN_F[0] + gamma[0]);
          const o1 = j === 1 ? kj : k === 1 ? kk : Math.floor(px * COS_F[1] + py * SIN_F[1] + gamma[1]);
          const o2 = j === 2 ? kj : k === 2 ? kk : Math.floor(px * COS_F[2] + py * SIN_F[2] + gamma[2]);
          const o3 = j === 3 ? kj : k === 3 ? kk : Math.floor(px * COS_F[3] + py * SIN_F[3] + gamma[3]);
          const o4 = j === 4 ? kj : k === 4 ? kk : Math.floor(px * COS_F[4] + py * SIN_F[4] + gamma[4]);
          // Dedup on the offset key — small ints, no BigInt-add cost.
          const key = `${o0},${o1},${o2},${o3},${o4}`;
          if (seen.has(key)) continue;
          seen.add(key);
          // Rhombus vertices in offset coords.
          const v00: Vec2 = [px, py];
          const v10: Vec2 = [px + dxJ, py + dyJ];
          const v11: Vec2 = [px + dxJ + dxK, py + dyJ + dyK];
          const v01: Vec2 = [px + dxK, py + dyK];
          const coord: Coord = [
            anchor.nProj[0] + BigInt(o0),
            anchor.nProj[1] + BigInt(o1),
            anchor.nProj[2] + BigInt(o2),
            anchor.nProj[3] + BigInt(o3),
            anchor.nProj[4] + BigInt(o4),
          ];
          tiles.push({ coord, type, vertices: [v00, v10, v11, v01] });
        }
      }
    }
  }
  return tiles;
}
