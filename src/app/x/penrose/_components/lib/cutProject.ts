// Data for the cut-and-project sketch (spine section 6, "So you solve it globally").
//
// The teaching claim: stop tiling locally. Every tile is the shadow of a point in
// the 5D integer lattice ℤ⁵, and a point becomes a tiling vertex iff its INTERNAL
// shadow lands inside a small acceptance window. The test is local to each point,
// so the plane is computed and can never strand. This module produces exactly the
// numbers the sketch draws, all through the real engine (cap.ts, pentagrid.ts), so
// the picture is the math and the colocated test can bind the two.
//
// Two frames, both from cap.ts:
//   physical(n) places a vertex in the plane (left panel, the tiling).
//   internal(n) is the "shadow" (right panel, the bounded acceptance space).
// A tile [coord; j,k] is the rhombus with corners coord, +e_j, +e_j+e_k, +e_k. It
// is a real tile iff all four corners pass inWindow at this tiling's window center.

import {
  internal,
  physical,
  index,
  inWindow,
  TAU,
  type Pt,
  type Vec5,
} from "../../explore/lib/cap";
import { facesInViewport, GAMMA, WINDOW_CENTER } from "../../explore/lib/pentagrid";
import type { RenderFace } from "../../explore/lib/patch";

export type { Pt, Vec5 } from "../../explore/lib/cap";

const [VX, VY] = WINDOW_CENTER;

// The four corner ℤ⁵ coords of the rhombus [coord; j,k], cyclic:
// n, n+e_j, n+e_j+e_k, n+e_k. The same order patch.ts and pentagrid use, so the
// physical corners line up tile for tile with what the enumerator drew.
export function cornerCoords(
  coord: readonly number[],
  j: number,
  k: number,
): [Vec5, Vec5, Vec5, Vec5] {
  const c0 = [...coord];
  const c1 = [...c0];
  c1[j]++;
  const c2 = [...c1];
  c2[k]++;
  const c3 = [...c0];
  c3[k]++;
  return [c0, c1, c2, c3] as unknown as [Vec5, Vec5, Vec5, Vec5];
}

// One accepted tile: its address, the four corner coords, and both projections of
// each corner. physical[] feeds the left panel, internal[] the right.
export type SketchTile = {
  key: string;
  coord: readonly number[];
  j: number;
  k: number;
  type: "thick" | "thin";
  // Corner data, index-aligned (length 4, cyclic).
  cornerCoords: [Vec5, Vec5, Vec5, Vec5];
  physical: [Pt, Pt, Pt, Pt];
  internal: [Pt, Pt, Pt, Pt];
};

function toSketchTile(f: RenderFace): SketchTile {
  const cc = cornerCoords(f.coord, f.j, f.k);
  return {
    key: f.key,
    coord: f.coord,
    j: f.j,
    k: f.k,
    type: f.type,
    cornerCoords: cc,
    physical: cc.map(physical) as [Pt, Pt, Pt, Pt],
    internal: cc.map(internal) as [Pt, Pt, Pt, Pt],
  };
}

// A real patch of the fixed tiling, the same enumerator the explorer runs, at the
// pinned window center. A modest viewport: enough tiles to read as a tiling, small
// enough to draw cleanly.
const VIEW = { minX: -5.5, minY: -5.5, maxX: 5.5, maxY: 5.5 };

export function buildPatch(): SketchTile[] {
  return facesInViewport(VIEW, GAMMA)
    .map(toSketchTile)
    .sort((a, b) => a.key.localeCompare(b.key));
}

// A rejected lattice point: index in {1..4} (so it is a candidate vertex) but its
// internal shadow falls OUTSIDE the acceptance window, so the plane discards it.
export type Rejected = { coord: Vec5; internal: Pt };

// Sample ℤ⁵ points whose shadow lands outside the window, for the "discarded"
// dots on the right. We scan a small lattice box, keep points with index in
// {1..4} that fail inWindow, and whose shadow sits near (but outside) the window
// so the dots read as "just missed" rather than scattered to infinity. Deterministic.
export function rejectedPoints(limit = 7): Rejected[] {
  const out: Rejected[] = [];
  const n = [0, 0, 0, 0, 0];
  const R = 2;
  for (n[0] = -R; n[0] <= R; n[0]++)
    for (n[1] = -R; n[1] <= R; n[1]++)
      for (n[2] = -R; n[2] <= R; n[2]++)
        for (n[3] = -R; n[3] <= R; n[3]++)
          for (n[4] = -R; n[4] <= R; n[4]++) {
            const v = [n[0], n[1], n[2], n[3], n[4]] as unknown as Vec5;
            const idx = index(v);
            if (idx < 1 || idx > 4) continue;
            if (inWindow(v, VX, VY)) continue;
            const [ix, iy] = internal(v);
            const r = Math.hypot(ix - VX, iy - VY);
            // Just outside the largest window (circumradius τ), not way out.
            if (r > TAU && r < TAU + 1.1) out.push({ coord: v, internal: [ix, iy] });
          }
  // Spread the kept dots around the window so they don't pile on one side.
  out.sort((a, b) => Math.atan2(a.internal[1] - VY, a.internal[0] - VX) - Math.atan2(b.internal[1] - VY, b.internal[0] - VX));
  const step = Math.max(1, Math.floor(out.length / limit));
  const spread: Rejected[] = [];
  for (let i = 0; i < out.length && spread.length < limit; i += step) spread.push(out[i]);
  return spread;
}

// The acceptance window for an index, centered at the tiling's window center.
// inWindow tests internal(n) against v + s·P, where P is the unit pentagon and
// s = SCALE_BY_INDEX[idx]. The four nested pentagons, by index, in INTERNAL space.
// We expose center, scale, and a flag for whether the pentagon is reflected
// (negative scale) so the sketch can draw the same outline inWindow checks against.
export const WINDOW = { vx: VX, vy: VY } as const;
const SCALE_BY_INDEX = [0, 1, -TAU, TAU, -1];

// Pentagon outline (circumradius 1, a vertex at angle 0), the unit window P that
// inPentagon tests. Scaled and translated, this is the index window's boundary.
export function unitPentagon(): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (2 * Math.PI * i) / 5;
    pts.push([Math.cos(a), Math.sin(a)]);
  }
  return pts;
}

// The boundary polygon of the index window in internal space: vertices of
// v + s·P. Negative s reflects through v, which is the genuine window for that index.
export function windowPolygon(idx: number): Pt[] {
  const s = SCALE_BY_INDEX[idx];
  return unitPentagon().map(([x, y]) => [VX + s * x, VY + s * y] as Pt);
}

export const INDICES = [1, 2, 3, 4] as const;
