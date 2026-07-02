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

// The four cyclic corner coords of the rhombus [coord; j,k]: n, n+e_j, n+e_j+e_k, n+e_k.
// The bump sequence and the Vec5 cast live only here; every caller routes through this.
function corners4(coord: readonly number[], j: number, k: number): [Vec5, Vec5, Vec5, Vec5] {
  const c0 = [...coord];
  const c1 = [...c0]; c1[j]++;
  const c2 = [...c1]; c2[k]++;
  const c3 = [...c0]; c3[k]++;
  return [c0, c1, c2, c3] as unknown as [Vec5, Vec5, Vec5, Vec5];
}

// Average of the given points.
function centroid(pts: readonly Pt[]): Pt {
  let x = 0, y = 0;
  for (const [px, py] of pts) { x += px; y += py; }
  return [x / pts.length, y / pts.length];
}

// Canonical face key for a tile address: "n0,n1,n2,n3,n4|jk".
function faceKey(coord: readonly number[], j: number, k: number): string {
  return `${coord.join(",")}|${j}${k}`;
}

// A rhombus is thick when its family gap is 1 or 4, thin otherwise.
function rhombusType(j: number, k: number): "thick" | "thin" {
  return k - j === 1 || k - j === 4 ? "thick" : "thin";
}

// Physical centroid of the rhombus [coord; j,k]: average of its four corners
// n, n+e_j, n+e_j+e_k, n+e_k under physical(). Task 3 reuses this to recenter the
// camera on a tile address without rebuilding the whole face.
export function tileCentroid(coord: readonly number[], j: number, k: number): Pt {
  return centroid(corners4(coord, j, k).map(physical));
}

// Is the rhombus [n; j,k] a real tile? It exists iff all four corners
// n, n+e_j, n+e_k, n+e_j+e_k are accepted vertices, the corner-acceptance
// condition faces.ts uses, evaluated against this tiling's window center.
// A shared URL decodes to a shape-valid address; only this confirms it names a
// tile the plane actually emits, so the camera does not pin empty space.
export function tileExists(coord: readonly number[], j: number, k: number): boolean {
  return corners4(coord, j, k).every((c) => inWindow(c, WINDOW_CENTER[0], WINDOW_CENTER[1]));
}

// ---------------------------------------------------------------------------
// The pentagrid view, for the teaching sketch. Same construction as
// facesInViewport, but it also returns the five families of grid lines (in
// grid space) and tags each crossing with the tile it becomes. de Bruijn:
// a crossing of families j,k IS the rhombus [K; j,k]. This is the real
// bijection, not an analogy, so a sketch can draw a line from any crossing to
// its tile and be telling the truth.
// ---------------------------------------------------------------------------

export type GridLine = { l: number; m: number; a: Pt; b: Pt }; // segment in grid space
export type GridCrossing = { z: Pt; j: number; k: number; face: RenderFace };
export type PentagridView = {
  zRegion: Rect;
  lines: GridLine[];
  crossings: GridCrossing[];
};

// Clip the grid line z·(PCOS[l],PSIN[l]) = c to a rect; null if it misses.
function clipGridLine(l: number, c: number, rect: Rect): [Pt, Pt] | null {
  const nx = PCOS[l], ny = PSIN[l];
  const z0x = c * nx, z0y = c * ny; // closest point on the line to the origin
  const dx = -ny, dy = nx; // along the line
  let sLo = -Infinity, sHi = Infinity;
  if (Math.abs(dx) > 1e-12) {
    const s1 = (rect.minX - z0x) / dx, s2 = (rect.maxX - z0x) / dx;
    sLo = Math.max(sLo, Math.min(s1, s2));
    sHi = Math.min(sHi, Math.max(s1, s2));
  } else if (z0x < rect.minX || z0x > rect.maxX) return null;
  if (Math.abs(dy) > 1e-12) {
    const s1 = (rect.minY - z0y) / dy, s2 = (rect.maxY - z0y) / dy;
    sLo = Math.max(sLo, Math.min(s1, s2));
    sHi = Math.min(sHi, Math.max(s1, s2));
  } else if (z0y < rect.minY || z0y > rect.maxY) return null;
  if (sLo > sHi) return null;
  return [
    [z0x + sLo * dx, z0y + sLo * dy],
    [z0x + sHi * dx, z0y + sHi * dy],
  ];
}

export function pentagridView(view: Rect, gamma: readonly number[]): PentagridView {
  const [pgx, pgy] = physicalGamma(gamma);
  const zx0 = (2 / 5) * (view.minX - pgx), zx1 = (2 / 5) * (view.maxX - pgx);
  const zy0 = (2 / 5) * (view.minY - pgy), zy1 = (2 / 5) * (view.maxY - pgy);
  const zRegion: Rect = {
    minX: Math.min(zx0, zx1) - GRID_MARGIN, maxX: Math.max(zx0, zx1) + GRID_MARGIN,
    minY: Math.min(zy0, zy1) - GRID_MARGIN, maxY: Math.max(zy0, zy1) + GRID_MARGIN,
  };

  const ranges: [number, number][] = [];
  for (let l = 0; l < 5; l++) ranges.push(lineRange(zRegion, l, gamma));

  const lines: GridLine[] = [];
  for (let l = 0; l < 5; l++) {
    const [lo, hi] = ranges[l];
    for (let m = lo; m <= hi; m++) {
      const seg = clipGridLine(l, m - gamma[l], zRegion);
      if (seg) lines.push({ l, m, a: seg[0], b: seg[1] });
    }
  }

  const crossings: GridCrossing[] = [];
  const seen = new Set<string>();
  for (let j = 0; j < 5; j++) {
    for (let k = j + 1; k < 5; k++) {
      const [mjLo, mjHi] = ranges[j];
      const [mkLo, mkHi] = ranges[k];
      for (let mj = mjLo; mj <= mjHi; mj++) {
        for (let mk = mkLo; mk <= mkHi; mk++) {
          const [x, y] = solveCrossing(j, k, mj - gamma[j], mk - gamma[k]);
          if (x < zRegion.minX || x > zRegion.maxX || y < zRegion.minY || y > zRegion.maxY) continue;
          const eps = 1e-7;
          const nx = x + eps * PCOS[j] + eps * PCOS[k];
          const ny = y + eps * PSIN[j] + eps * PSIN[k];
          const K = new Array(5) as number[];
          for (let l = 0; l < 5; l++) K[l] = Math.ceil(fl(nx, ny, l) + gamma[l]);
          K[j] = mj; K[k] = mk;
          const [p0, p1, p2, p3] = corners4(K, j, k).map(physical);
          const key = faceKey(K, j, k);
          if (seen.has(key)) continue;
          seen.add(key);
          crossings.push({
            z: [x, y],
            j,
            k,
            face: {
              key, coord: K, j, k,
              type: rhombusType(j, k),
              corners: [p0, p1, p2, p3],
              centroid: centroid([p0, p1, p2, p3]),
            },
          });
        }
      }
    }
  }
  return { zRegion, lines, crossings };
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
          const [p0, p1, p2, p3] = corners4(K, j, k).map(physical);
          const c: Pt = centroid([p0, p1, p2, p3]);

          // Step 4: filter by physical centroid.
          if (c[0] < keepMinX || c[0] > keepMaxX || c[1] < keepMinY || c[1] > keepMaxY) continue;

          const key = faceKey(K, j, k);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            key, coord: K, j, k,
            type: rhombusType(j, k),
            corners: [p0, p1, p2, p3], centroid: c,
          });
        }
      }
    }
  }
  return out;
}
