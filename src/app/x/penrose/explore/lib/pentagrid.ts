// src/app/x/penrose/explore/lib/pentagrid.ts
// Fast pentagrid viewport enumerator for a fixed generic Penrose tiling.
//
// A tile is a de Bruijn line-crossing of families j<k at grid point z. It RENDERS at
// physical(K) = (5/2) z + physical(gamma) + bounded, so the crossing z is pulled ~2/5
// toward the origin from the tile body. Own and filter tiles by physical(K), never by z.
//
//   1. Map the physical viewport V into a grid-space z region: z ~= (2/5)(V - physical(gamma)),
//      grown by a CONSTANT grid margin that covers the bounded term.
//   2. Per-family integer line ranges over that z region; solve every j<k crossing.
//   3. Local address K = ceil(f_l(z + eps nudge) + gamma_l), forcing K_j,K_k to the crossing.
//   4. Keep iff the physical(K) centroid lies in V grown by one tile.
//
// Verified key-for-key against cap.generate() (the tested cut-and-project oracle) and
// adversarially confirmed to drop zero tiles in far-from-origin viewports.

import { PCOS, PSIN, ICOS, ISIN, physical, inWindow, type Vec5 } from "./cap";
import type { Pt, RenderFace } from "./patch";

export type Rect = { minX: number; minY: number; maxX: number; maxY: number };

export const WINDOW_CENTER: readonly [number, number] = [0.137, -0.081];

// gamma_l = (2/5)(vx*ICOS[l] + vy*ISIN[l]); then internal(gamma) = (vx,vy) and Sum gamma = 0.
export function gammaFromWindowCenter(vx: number, vy: number): number[] {
  const g = new Array(5);
  for (let l = 0; l < 5; l++) g[l] = (2 / 5) * (vx * ICOS[l] + vy * ISIN[l]);
  return g;
}

export const GAMMA: readonly number[] = gammaFromWindowCenter(WINDOW_CENTER[0], WINDOW_CENTER[1]);

const GRID_MARGIN = 1.0; // grid-space; >= (2/5)*phi ~= 0.65 covers the bounded term

const fl = (x: number, y: number, l: number) => x * PCOS[l] + y * PSIN[l];

function physicalGamma(gamma: readonly number[]): [number, number] {
  let x = 0, y = 0;
  for (let l = 0; l < 5; l++) { x += gamma[l] * PCOS[l]; y += gamma[l] * PSIN[l]; }
  return [x, y];
}

function lineRange(rect: Rect, l: number, gamma: readonly number[]): [number, number] {
  const c = [
    fl(rect.minX, rect.minY, l), fl(rect.maxX, rect.minY, l),
    fl(rect.minX, rect.maxY, l), fl(rect.maxX, rect.maxY, l),
  ];
  return [Math.ceil(Math.min(...c) + gamma[l]), Math.floor(Math.max(...c) + gamma[l])];
}

function solveCrossing(j: number, k: number, aj: number, ak: number): [number, number] {
  const a = PCOS[j], b = PSIN[j], c = PCOS[k], d = PSIN[k];
  const det = a * d - b * c;
  return [(aj * d - b * ak) / det, (a * ak - aj * c) / det];
}

// Physical centroid of the rhombus [coord; j,k]: average of its four corners
// n, n+e_j, n+e_j+e_k, n+e_k under physical(). Task 3 reuses this to recenter the
// camera on a tile address without rebuilding the whole face.
export function tileCentroid(coord: readonly number[], j: number, k: number): Pt {
  const c0 = coord as unknown as Vec5;
  const c1 = [...coord]; c1[j]++;
  const c2 = [...c1]; c2[k]++;
  const c3 = [...coord]; c3[k]++;
  const p0 = physical(c0), p1 = physical(c1 as unknown as Vec5);
  const p2 = physical(c2 as unknown as Vec5), p3 = physical(c3 as unknown as Vec5);
  return [(p0[0] + p1[0] + p2[0] + p3[0]) / 4, (p0[1] + p1[1] + p2[1] + p3[1]) / 4];
}

// Is the rhombus [n; j,k] a real tile? It exists iff all four corners
// n, n+e_j, n+e_k, n+e_j+e_k are accepted vertices, the corner-acceptance
// condition faces.ts uses, evaluated against this tiling's window center.
// A shared URL decodes to a shape-valid address; only this confirms it names a
// tile the plane actually emits, so the camera does not pin empty space.
export function tileExists(coord: readonly number[], j: number, k: number): boolean {
  const [vx, vy] = WINDOW_CENTER;
  const n = coord as unknown as Vec5;
  const nj = [...coord]; nj[j]++;
  const nk = [...coord]; nk[k]++;
  const njk = [...nj]; njk[k]++;
  return (
    inWindow(n, vx, vy) &&
    inWindow(nj as unknown as Vec5, vx, vy) &&
    inWindow(nk as unknown as Vec5, vx, vy) &&
    inWindow(njk as unknown as Vec5, vx, vy)
  );
}

export function facesInViewport(view: Rect, gamma: readonly number[], physicalMargin = 1.5): RenderFace[] {
  const out: RenderFace[] = [];
  const seen = new Set<string>();

  // Step 1: physical viewport -> grid-space z region.
  const [pgx, pgy] = physicalGamma(gamma);
  const zx0 = (2 / 5) * (view.minX - pgx), zx1 = (2 / 5) * (view.maxX - pgx);
  const zy0 = (2 / 5) * (view.minY - pgy), zy1 = (2 / 5) * (view.maxY - pgy);
  const zRegion: Rect = {
    minX: Math.min(zx0, zx1) - GRID_MARGIN, maxX: Math.max(zx0, zx1) + GRID_MARGIN,
    minY: Math.min(zy0, zy1) - GRID_MARGIN, maxY: Math.max(zy0, zy1) + GRID_MARGIN,
  };

  // Step 2: per-family line ranges over the z region.
  const ranges: [number, number][] = [];
  for (let l = 0; l < 5; l++) ranges.push(lineRange(zRegion, l, gamma));

  const keepMinX = view.minX - physicalMargin, keepMaxX = view.maxX + physicalMargin;
  const keepMinY = view.minY - physicalMargin, keepMaxY = view.maxY + physicalMargin;

  for (let j = 0; j < 5; j++) {
    for (let k = j + 1; k < 5; k++) {
      const [mjLo, mjHi] = ranges[j];
      const [mkLo, mkHi] = ranges[k];
      for (let mj = mjLo; mj <= mjHi; mj++) {
        for (let mk = mkLo; mk <= mkHi; mk++) {
          const [x, y] = solveCrossing(j, k, mj - gamma[j], mk - gamma[k]);
          if (x < zRegion.minX || x > zRegion.maxX || y < zRegion.minY || y > zRegion.maxY) continue;

          // Step 3: local address. Nudge +eps along both family normals so ceil resolves
          // into the cell whose min-on-(j,k) corner is the (mj,mk) crossing corner.
          const eps = 1e-7;
          const nx = x + eps * PCOS[j] + eps * PCOS[k];
          const ny = y + eps * PSIN[j] + eps * PSIN[k];
          const K = new Array(5) as number[];
          for (let l = 0; l < 5; l++) K[l] = Math.ceil(fl(nx, ny, l) + gamma[l]);
          K[j] = mj; K[k] = mk;

          // corners n, n+e_j, n+e_j+e_k, n+e_k (cyclic), positions via physical.
          const c0 = K as unknown as Vec5;
          const c1 = [...K]; c1[j]++;
          const c2 = [...c1]; c2[k]++;
          const c3 = [...K]; c3[k]++;
          const p0 = physical(c0), p1 = physical(c1 as unknown as Vec5), p2 = physical(c2 as unknown as Vec5), p3 = physical(c3 as unknown as Vec5);
          const centroid: Pt = [(p0[0] + p1[0] + p2[0] + p3[0]) / 4, (p0[1] + p1[1] + p2[1] + p3[1]) / 4];

          // Step 4: filter by physical centroid.
          if (centroid[0] < keepMinX || centroid[0] > keepMaxX || centroid[1] < keepMinY || centroid[1] > keepMaxY) continue;

          const key = `${K.join(",")}|${j}${k}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const d = k - j;
          out.push({
            key, coord: K, j, k,
            type: d === 1 || d === 4 ? "thick" : "thin",
            corners: [p0, p1, p2, p3], centroid,
          });
        }
      }
    }
  }
  return out;
}
