// Data for "the dead-ends, seen in the window" (spine, after cut and project). This
// unifies two earlier threads. Tiling by hand can fit a piece and still strand you
// (sketches 02/03); cut and project never strands because it tests every tile against
// ONE fixed window (sketch 05). This module shows WHY, in the window itself.
//
// THE CONSTRUCTION, made precise and honest.
//   A vertex n in Z^5 is accepted by a window centred at v iff internal(n) lies in the
//   index-σ pentagon centred at v, i.e. (internal(n) - v)/s in P, with s the index
//   scale (cap.ts inWindow). Invert it: the set of window centres that accept n is the
//   pentagon  accept(n) = internal(n) - s·P  in window-centre space. A patch is a
//   sub-patch of SOME cut-and-project tiling iff there is one window centre accepting
//   all its vertices, i.e. iff the INTERSECTION of accept(n) over its vertices is
//   non-empty (then every placed rhombus has four accepted corners, so it is a face).
//
//   So: place correct tiles and that intersection shrinks but stays non-empty (it
//   always contains the true window centre). A move that fits with zero overlap yet is
//   not a cut-and-project face can drive the intersection EMPTY: no window accepts the
//   patch, so it can never be completed. That is the dead-end, seen in the window.
//
// HONEST BY CONSTRUCTION. accept(n) is the algebraic inverse of cap.ts inWindow (a test
// checks v in accept(n) <=> inWindow(n,v)). The correct tiles are real faces from the
// enumerator. The fatal tile is verified to (a) not be a face, (b) not overlap any
// placed tile by real area, and (c) take the non-empty region to empty. windowStrand.test.ts
// binds all of it.

import { internal, index, physical, TAU, type Pt, type Vec5 } from "../../explore/lib/cap";
import { facesInViewport, GAMMA, tileExists, WINDOW_CENTER, type Rect } from "../../explore/lib/pentagrid";

const SCALE_BY_INDEX = [0, 1, -TAU, TAU, -1];

export type PolyPt = [number, number];
export type WSFace = {
  coord: number[];
  j: number;
  k: number;
  type: "thick" | "thin";
  phys: PolyPt[]; // four physical corners, cyclic
};
export type WSStep = { face: WSFace; region: PolyPt[] }; // window region AFTER placing face
export type WindowStrand = {
  center: PolyPt; // the true window centre w0
  build: WSStep[]; // correct tiles, in build order; region shrinks, never empty
  // The fatal move: it fits, but the culprit corner's accept pentagon excludes the
  // whole region, so no window survives. culpritInternal is that corner's shadow.
  wrong: { face: WSFace; accept: PolyPt[]; culpritInternal: PolyPt; regionBefore: PolyPt[] };
  physBounds: { minX: number; minY: number; maxX: number; maxY: number };
};

const BUILD_COUNT = 10; // correct tiles, nearest the anchor; small enough to read
const ANCHOR: PolyPt = [0, 0];

// ---- vector helpers on Z^5 ----
const e = (l: number): Vec5 => { const v = [0, 0, 0, 0, 0]; v[l] = 1; return v as unknown as Vec5; };
const addv = (a: Vec5, b: Vec5): Vec5 => a.map((x, i) => x + b[i]) as unknown as Vec5;
const subv = (a: Vec5, b: Vec5): Vec5 => a.map((x, i) => x - b[i]) as unknown as Vec5;
const corners = (n: Vec5, j: number, k: number): Vec5[] => [n, addv(n, e(j)), addv(addv(n, e(j)), e(k)), addv(n, e(k))];
const physCorners = (n: Vec5, j: number, k: number): PolyPt[] => corners(n, j, k).map((c) => physical(c) as PolyPt);

// ---- the accept pentagon: window centres that accept vertex n ----
// accept(n) = internal(n) - s·P, returned CCW. v in accept(n)  <=>  inWindow(n, v).
export function acceptPentagon(n: Vec5): PolyPt[] {
  const s = SCALE_BY_INDEX[index(n)];
  const [ix, iy] = internal(n);
  const pts: PolyPt[] = [];
  for (let m = 0; m < 5; m++) {
    const a = (2 * Math.PI * m) / 5;
    pts.push([ix - s * Math.cos(a), iy - s * Math.sin(a)]);
  }
  pts.sort((u, w) => Math.atan2(u[1] - iy, u[0] - ix) - Math.atan2(w[1] - iy, w[0] - ix));
  return pts;
}

// ---- convex polygon intersection (Sutherland-Hodgman; clip is CCW convex) ----
export function clipConvex(subject: PolyPt[], clip: PolyPt[]): PolyPt[] {
  let out = subject;
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const inside = (p: PolyPt) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-12;
    const cut = (p: PolyPt, q: PolyPt): PolyPt => {
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const den = dx * (b[1] - a[1]) - dy * (b[0] - a[0]);
      const t = ((a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0])) / den;
      return [p[0] + t * dx, p[1] + t * dy];
    };
    const inp = out; out = [];
    for (let j = 0; j < inp.length; j++) {
      const cur = inp[j], prev = inp[(j + inp.length - 1) % inp.length];
      const ci = inside(cur), pi = inside(prev);
      if (ci) { if (!pi) out.push(cut(prev, cur)); out.push(cur); }
      else if (pi) out.push(cut(prev, cur));
    }
    if (out.length === 0) return [];
  }
  return out;
}

export function polyArea(poly: PolyPt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a) / 2;
}

// Real-area overlap of two convex polygons (SAT, with a touch epsilon so shared edges
// do not count). Matches the "fits with zero overlap" claim of the dead-end sketches.
export function overlaps(A: PolyPt[], B: PolyPt[]): boolean {
  const axes = (poly: PolyPt[]) => poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length];
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const L = Math.hypot(dx, dy) || 1;
    return [-dy / L, dx / L] as PolyPt;
  });
  const proj = (poly: PolyPt[], ax: PolyPt) => {
    let lo = Infinity, hi = -Infinity;
    for (const p of poly) { const d = p[0] * ax[0] + p[1] * ax[1]; lo = Math.min(lo, d); hi = Math.max(hi, d); }
    return [lo, hi] as const;
  };
  for (const ax of [...axes(A), ...axes(B)]) {
    const [a0, a1] = proj(A, ax), [b0, b1] = proj(B, ax);
    if (Math.min(a1, b1) - Math.max(a0, b0) <= 1e-6) return false; // a separating axis
  }
  return true;
}

const faceKey = (n: readonly number[], j: number, k: number) => `${n.join(",")}|${j}${k}`;
const toWSFace = (n: Vec5, j: number, k: number): WSFace => ({
  coord: [...n],
  j, k,
  type: k - j === 1 || k - j === 4 ? "thick" : "thin",
  phys: physCorners(n, j, k),
});

// Build the deterministic scene: a small correct patch, its shrinking window region,
// and the fatal non-overlapping move that empties it.
export function buildWindowStrand(): WindowStrand {
  const view: Rect = { minX: -4, minY: -4, maxX: 4, maxY: 4 };
  const allFaces = facesInViewport(view, GAMMA);

  // Correct patch: the BUILD_COUNT faces nearest the anchor, by physical centroid.
  const dist = (f: { centroid: Pt }) => Math.hypot(f.centroid[0] - ANCHOR[0], f.centroid[1] - ANCHOR[1]);
  const ordered = [...allFaces].sort((a, b) => dist(a) - dist(b) || faceKey(a.coord, a.j, a.k).localeCompare(faceKey(b.coord, b.j, b.k)));
  const built = ordered.slice(0, BUILD_COUNT);
  const builtKeys = new Set(built.map((f) => faceKey(f.coord, f.j, f.k)));
  const builtPolys = built.map((f) => physCorners(f.coord as Vec5, f.j, f.k));

  // Per-step window region: clip a big box by each placed vertex's accept pentagon.
  const BIG: PolyPt[] = [[-8, -8], [8, -8], [8, 8], [-8, 8]];
  const seenV = new Set<string>();
  let region = BIG;
  const build: WSStep[] = [];
  for (const f of built) {
    for (const c of corners(f.coord as Vec5, f.j, f.k)) {
      const key = c.join(",");
      if (!seenV.has(key)) { seenV.add(key); region = clipConvex(region, acceptPentagon(c)); }
    }
    build.push({ face: toWSFace(f.coord as Vec5, f.j, f.k), region });
  }
  const regionBefore = region;

  // Boundary edges of the built patch (in exactly one built face).
  const edgeFaces = new Map<string, number>();
  const edgeInfo = new Map<string, { a: Vec5; b: Vec5; l: number }>();
  for (const f of built) {
    const cs = corners(f.coord as Vec5, f.j, f.k);
    for (let i = 0; i < 4; i++) {
      const a = cs[i], b = cs[(i + 1) % 4];
      let l = -1; for (let t = 0; t < 5; t++) if (a[t] !== b[t]) { l = t; break; }
      const key = [a.join(","), b.join(",")].sort().join("~");
      edgeFaces.set(key, (edgeFaces.get(key) ?? 0) + 1);
      if (!edgeInfo.has(key)) edgeInfo.set(key, { a, b, l });
    }
  }
  const boundary = [...edgeFaces.entries()].filter(([k]) => edgeFaces.get(k) === 1).map(([k]) => edgeInfo.get(k)!);

  // Fatal move: a rhombus sharing a boundary edge that is NOT a face, fits with zero
  // overlap, and drives the region empty. Deterministic: nearest the anchor, then key.
  type Cand = { n: Vec5; j: number; k: number; cx: number; cy: number };
  const cands: Cand[] = [];
  const seenC = new Set<string>();
  for (const { a, l } of boundary) {
    for (let m = 0; m < 5; m++) {
      if (m === l) continue;
      const j = Math.min(l, m), k = Math.max(l, m);
      for (const base of [a, subv(a, e(m))]) {
        const key = faceKey([...base], j, k);
        if (builtKeys.has(key) || seenC.has(key)) continue;
        const cs = corners(base, j, k).map((c) => c.join(","));
        if (!cs.includes(a.join(",")) ) continue; // must actually touch the boundary vertex
        if (tileExists([...base], j, k)) continue; // skip real faces (other valid tilings)
        const poly = physCorners(base, j, k);
        if (builtPolys.some((bp) => overlaps(poly, bp))) continue; // must fit
        let reg = regionBefore;
        for (const c of corners(base, j, k)) reg = clipConvex(reg, acceptPentagon(c));
        if (polyArea(reg) > 1e-9) continue; // only the moves that strand
        seenC.add(key);
        let cx = 0, cy = 0; for (const p of poly) { cx += p[0]; cy += p[1]; }
        cands.push({ n: base, j, k, cx: cx / 4, cy: cy / 4 });
      }
    }
  }
  cands.sort((c1, c2) =>
    Math.hypot(c1.cx - ANCHOR[0], c1.cy - ANCHOR[1]) - Math.hypot(c2.cx - ANCHOR[0], c2.cy - ANCHOR[1]) ||
    faceKey([...c1.n], c1.j, c1.k).localeCompare(faceKey([...c2.n], c2.j, c2.k)));
  const w = cands[0];
  const wrongFace = toWSFace(w.n, w.j, w.k);

  // The culprit corner: a corner whose accept pentagon alone excludes the region (so
  // its shadow can never share a window with the patch). Prefer a corner new to the
  // patch; fall back to the base corner.
  const builtVerts = new Set<string>();
  for (const f of built) for (const c of corners(f.coord as Vec5, f.j, f.k)) builtVerts.add(c.join(","));
  const wrongCorners = corners(w.n, w.j, w.k);
  let culprit = w.n;
  for (const c of wrongCorners) {
    const isNew = !builtVerts.has(c.join(","));
    if (isNew && polyArea(clipConvex(regionBefore, acceptPentagon(c))) < 1e-9) { culprit = c; break; }
  }

  // Physical extent over every drawn tile.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of [...builtPolys, wrongFace.phys]) for (const [x, y] of poly) {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }

  return {
    center: [WINDOW_CENTER[0], WINDOW_CENTER[1]],
    build,
    wrong: {
      face: wrongFace,
      accept: acceptPentagon(culprit),
      culpritInternal: internal(culprit) as PolyPt,
      regionBefore,
    },
    physBounds: { minX, minY, maxX, maxY },
  };
}
