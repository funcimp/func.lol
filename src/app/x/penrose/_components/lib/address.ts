// Data for the "every tile knows its address" sketch (spine section 8). The address
// is the tile's ℤ⁵ coordinate, and the five integers are literally step counts along
// the five pentagon directions: physical(n) = sum_l n_l * d_l, where d_l is the unit
// vector at angle 72*l degrees, the same five directions the tile edges run along. So
// the address is a walk from the lattice origin straight to the tile's corner. Bound
// to the real engine (cap.ts, buildPatch) by address.test.ts.

import { PCOS, PSIN, type Pt } from "../../explore/lib/cap";
import { buildPatch } from "./cutProject";

// The five physical edge directions, d_l at angle 72*l degrees.
export const DIRS: Pt[] = PCOS.map((c, l) => [c, PSIN[l]] as Pt);

export type WalkGroup = { l: number; count: number };
export type AddressTile = {
  coord: number[];
  type: "thick" | "thin";
  corners: Pt[]; // the tile's physical corners
  groups: WalkGroup[]; // the nonzero directions, in index order
  path: Pt[]; // origin, then the point after each unit step; last = the tile corner
};

// The straight walk, direction by direction in index order: |n_l| unit steps along
// (or against, if n_l < 0) each d_l. path[0] is the origin, path.at(-1) is the corner.
export function walkPath(coord: readonly number[]): Pt[] {
  const path: Pt[] = [[0, 0]];
  let x = 0;
  let y = 0;
  for (let l = 0; l < 5; l++) {
    const step = Math.sign(coord[l]);
    for (let s = 0; s < Math.abs(coord[l]); s++) {
      x += step * DIRS[l][0];
      y += step * DIRS[l][1];
      path.push([x, y]);
    }
  }
  return path;
}

// How far the walk strays from the origin, so the sketch can frame it.
export function walkExtent(coord: readonly number[]): number {
  let m = 0;
  for (const [x, y] of walkPath(coord)) m = Math.max(m, Math.hypot(x, y));
  return m;
}

const nonzero = (c: readonly number[]) => c.filter((n) => n !== 0).length;
const stepCount = (c: readonly number[]) =>
  c.reduce((a, n) => a + Math.abs(n), 0);

// How far the walk may stray and still sit inside the drawn patch.
const EXT_MAX = 4.6;

// Deterministic representative: a real accepted tile with a long, rich walk, one that
// uses as many of the five directions as possible and as many steps as possible while
// staying inside the patch. Tie-break to the lexicographically greatest coord so
// positive steps lead. Bound to buildPatch, so it is a genuine tile of the real
// tiling, and the walk lands inside the tile set that fades in around it.
export function pickAddressTile(): AddressTile {
  const patch = buildPatch();
  const byCoord = new Map<string, (typeof patch)[number]>();
  for (const t of patch) {
    const k = (t.coord as number[]).join(",");
    if (!byCoord.has(k)) byCoord.set(k, t);
  }
  const tiles = [...byCoord.values()];
  const pool = tiles.filter((t) => {
    const c = t.coord as number[];
    return nonzero(c) >= 3 && walkExtent(c) <= EXT_MAX;
  });
  const ranked = (pool.length ? pool : tiles).slice().sort((a, b) => {
    const ca = a.coord as number[];
    const cb = b.coord as number[];
    const dn = nonzero(cb) - nonzero(ca); // more directions first
    if (dn !== 0) return dn;
    const ds = stepCount(cb) - stepCount(ca); // longer walk first
    if (ds !== 0) return ds;
    const ea = walkExtent(ca);
    const eb = walkExtent(cb);
    if (Math.abs(ea - eb) > 1e-9) return ea - eb; // tighter walk
    for (let i = 0; i < 5; i++) if (ca[i] !== cb[i]) return cb[i] - ca[i];
    return 0;
  });
  const best = ranked[0];
  // Normalize any -0 the enumerator produced to +0 so the address reads cleanly.
  const coord = (best.coord as number[]).map((n) => (n === 0 ? 0 : n));
  const groups: WalkGroup[] = [];
  for (let l = 0; l < 5; l++) {
    if (coord[l] !== 0) groups.push({ l, count: coord[l] });
  }
  return {
    coord,
    type: best.type,
    corners: best.physical.map(([x, y]) => [x, y] as Pt),
    groups,
    path: walkPath(coord),
  };
}
