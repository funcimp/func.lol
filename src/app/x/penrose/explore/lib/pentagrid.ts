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

const SCALE = 10n ** 50n;
const SCALE_F = Number(SCALE);
const SCALE2 = SCALE * SCALE;

function bigintSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("negative");
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

function bigintFloorDiv(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error("div by zero");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  if (n >= 0n) return n / d;
  return n % d === 0n ? n / d : n / d - 1n;
}

// Algebraic constants. cos(2π/5) = (√5 - 1)/4, sin(2π/5) = √(10+2√5)/4.
const SQRT5 = bigintSqrt(5n * SCALE2);
const SQRT_T_PLUS = bigintSqrt((10n * SCALE + 2n * SQRT5) * SCALE);
const SQRT_T_MINUS = bigintSqrt((10n * SCALE - 2n * SQRT5) * SCALE);

const COS_HI: readonly bigint[] = [
  SCALE,
  bigintFloorDiv(SQRT5 - SCALE, 4n),
  bigintFloorDiv(-(SQRT5 + SCALE), 4n),
  bigintFloorDiv(-(SQRT5 + SCALE), 4n),
  bigintFloorDiv(SQRT5 - SCALE, 4n),
];
const SIN_HI: readonly bigint[] = [
  0n,
  bigintFloorDiv(SQRT_T_PLUS, 4n),
  bigintFloorDiv(SQRT_T_MINUS, 4n),
  bigintFloorDiv(-SQRT_T_MINUS, 4n),
  bigintFloorDiv(-SQRT_T_PLUS, 4n),
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
    raw.push((BigInt(h) * SCALE) / (1n << 32n) - SCALE / 2n);
  }
  const sum = raw.reduce((a, b) => a + b, 0n);
  const shift = sum / 5n;
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

// Enumerate P3 rhombi whose tile-space position falls in the viewport
// rect. Each tile is at v_N = Σ_l n_l · e_l (de Bruijn dual lattice),
// with 4 unit-length corners {v_N, v_N + e_j, v_N + e_j + e_k, v_N + e_k}.
//
// rect is in TILE-space offset coords (relative to the anchor's lattice
// point). Pentagrid-space line bounds are derived from the rect via
// p ≈ (2/5)(v - Γ), where Γ = Σ_l γ_l · e_l. We over-iterate slightly
// to cover edge cases, then drop rhombi whose v_N is far outside rect.
//
// Tile type: |k - j| ∈ {1, 4} → thick (72° rhombus); {2, 3} → thin (36°).
export function enumerateTiles(anchor: Anchor, rect: Rect): Tile[] {
  const tiles: Tile[] = [];
  const gamma = anchor.fProj;
  const seen = new Set<string>();

  // Γ = Σ_l γ_l · e_l. Used to translate between tile- and pentagrid-space.
  let gammaCorrX = 0, gammaCorrY = 0;
  for (let l = 0; l < 5; l++) {
    gammaCorrX += gamma[l] * COS_F[l];
    gammaCorrY += gamma[l] * SIN_F[l];
  }

  // Pentagrid-space rect: p = (2/5)(v - Γ), with safety margin for the
  // O(1) bounded fractional correction Σ_l frac_l · e_l.
  const SHRINK = 2 / 5;
  const SAFETY = 3;
  const pgRect: Rect = {
    x0: SHRINK * (rect.x0 - gammaCorrX) - SAFETY,
    y0: SHRINK * (rect.y0 - gammaCorrY) - SAFETY,
    x1: SHRINK * (rect.x1 - gammaCorrX) + SAFETY,
    y1: SHRINK * (rect.y1 - gammaCorrY) + SAFETY,
  };

  for (let j = 0; j < 4; j++) {
    for (let k = j + 1; k < 5; k++) {
      const ejx = COS_F[j], ejy = SIN_F[j];
      const ekx = COS_F[k], eky = SIN_F[k];
      const det = ejx * eky - ejy * ekx;
      if (Math.abs(det) < 1e-12) continue;
      const invDet = 1 / det;

      // Line-index bounds from pentagrid-space rect projections.
      const pj0 = pgRect.x0 * ejx + pgRect.y0 * ejy;
      const pj1 = pgRect.x1 * ejx + pgRect.y0 * ejy;
      const pj2 = pgRect.x0 * ejx + pgRect.y1 * ejy;
      const pj3 = pgRect.x1 * ejx + pgRect.y1 * ejy;
      const pk0 = pgRect.x0 * ekx + pgRect.y0 * eky;
      const pk1 = pgRect.x1 * ekx + pgRect.y0 * eky;
      const pk2 = pgRect.x0 * ekx + pgRect.y1 * eky;
      const pk3 = pgRect.x1 * ekx + pgRect.y1 * eky;
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
          if (px < pgRect.x0 || px > pgRect.x1 || py < pgRect.y0 || py > pgRect.y1) continue;

          // Offset coords (small ints) for the 5-tuple.
          const o0 = j === 0 ? kj : k === 0 ? kk : Math.floor(px * COS_F[0] + py * SIN_F[0] + gamma[0]);
          const o1 = j === 1 ? kj : k === 1 ? kk : Math.floor(px * COS_F[1] + py * SIN_F[1] + gamma[1]);
          const o2 = j === 2 ? kj : k === 2 ? kk : Math.floor(px * COS_F[2] + py * SIN_F[2] + gamma[2]);
          const o3 = j === 3 ? kj : k === 3 ? kk : Math.floor(px * COS_F[3] + py * SIN_F[3] + gamma[3]);
          const o4 = j === 4 ? kj : k === 4 ? kk : Math.floor(px * COS_F[4] + py * SIN_F[4] + gamma[4]);
          const key = `${o0},${o1},${o2},${o3},${o4}`;
          if (seen.has(key)) continue;
          seen.add(key);

          // v_N in tile-space offset coords = Σ_l o_l · e_l. This is the
          // "upper-right" corner of the rhombus (n_j=kj, n_k=kk). The
          // other 3 corners come from the 3 adjacent cells around this
          // pentagrid vertex (n_j=kj-1 and/or n_k=kk-1), each sharing
          // the same "other 3 floors" so they differ from v_N only by
          // -e_j and/or -e_k.
          const vx = o0 * COS_F[0] + o1 * COS_F[1] + o2 * COS_F[2] + o3 * COS_F[3] + o4 * COS_F[4];
          const vy = o0 * SIN_F[0] + o1 * SIN_F[1] + o2 * SIN_F[2] + o3 * SIN_F[3] + o4 * SIN_F[4];

          // Cull rhombi whose entire bounding box falls outside the tile rect.
          if (vx + 2 < rect.x0 || vx - 2 > rect.x1 || vy + 2 < rect.y0 || vy - 2 > rect.y1) continue;

          // Unit-side P3 rhombus, traced in order around the corner cluster
          // at the pentagrid vertex.
          const vUR: Vec2 = [vx, vy];                       // n_j=kj,   n_k=kk
          const vUL: Vec2 = [vx - ejx, vy - ejy];           // n_j=kj-1, n_k=kk
          const vLL: Vec2 = [vx - ejx - ekx, vy - ejy - eky]; // n_j=kj-1, n_k=kk-1
          const vLR: Vec2 = [vx - ekx, vy - eky];           // n_j=kj,   n_k=kk-1
          const coord: Coord = [
            anchor.nProj[0] + BigInt(o0),
            anchor.nProj[1] + BigInt(o1),
            anchor.nProj[2] + BigInt(o2),
            anchor.nProj[3] + BigInt(o3),
            anchor.nProj[4] + BigInt(o4),
          ];
          tiles.push({ coord, type, vertices: [vLL, vLR, vUR, vUL] });
        }
      }
    }
  }
  return tiles;
}

// Point-in-polygon test for the hover readout. Tile vertices are
// convex (a rhombus); a half-plane test against each of the 4 edges
// is enough.
export function tileContains(tile: Tile, x: number, y: number): boolean {
  const verts = tile.vertices;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = verts[i];
    const [bx, by] = verts[(i + 1) % 4];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (sign !== s) return false;
  }
  return true;
}
