import { describe, expect, test } from "bun:test";

import { inWindow, index, type Vec5 } from "../../explore/lib/cap";
import { tileExists } from "../../explore/lib/pentagrid";
import {
  acceptPentagon,
  buildWindowStrand,
  clipConvex,
  overlaps,
  polyArea,
  type PolyPt,
} from "./windowStrand";

// This BINDS "the dead-ends, seen in the window" to the engine. The sketch claims a
// tile can fit with zero overlap yet leave no window that accepts the patch, which is
// exactly a dead-end. Every claim here is a test: the accept pentagon is the algebraic
// inverse of inWindow, the correct tiles keep the window region non-empty and shrinking,
// and the fatal tile fits, is not a real face, and drives the region empty.

const corners = (n: number[], j: number, k: number): Vec5[] => {
  const c0 = [...n]; const c1 = [...c0]; c1[j]++; const c2 = [...c1]; c2[k]++; const c3 = [...c0]; c3[k]++;
  return [c0, c1, c2, c3] as unknown as Vec5[];
};
const pointInConvex = (p: PolyPt, poly: PolyPt[], eps = 1e-9): boolean => {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) < -eps) return false;
  }
  return true;
};

describe("the accept pentagon is the inverse of inWindow", () => {
  // For a handful of vertices, v in acceptPentagon(n) must agree with inWindow(n, v)
  // across a grid of window centres. Skip the boundary band where float ties are noise.
  const ns: Vec5[] = [[1, 0, 1, 0, 0], [0, 0, 1, 0, 0], [1, 0, 0, 0, 1], [2, -1, -1, 0, 2]] as unknown as Vec5[];
  for (const n of ns) {
    if (index(n) < 1 || index(n) > 4) continue;
    test(`vertex [${(n as unknown as number[]).join(",")}]`, () => {
      const pent = acceptPentagon(n);
      let checked = 0;
      for (let gx = -30; gx <= 30; gx++) {
        for (let gy = -30; gy <= 30; gy++) {
          const v: PolyPt = [gx * 0.12, gy * 0.12];
          const inPent = pointInConvex(v, pent, 0);
          const inWin = inWindow(n, v[0], v[1]);
          // only assert away from the boundary, where rounding differs harmlessly
          const nearEdge = pointInConvex(v, pent, -0.01) !== pointInConvex(v, pent, 0.01);
          if (nearEdge) continue;
          expect(inPent).toBe(inWin);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(50);
    });
  }
});

describe("the window region shrinks but never empties through the correct build", () => {
  const ws = buildWindowStrand();

  test("every built tile is a real cut-and-project face", () => {
    expect(ws.build.length).toBeGreaterThan(6);
    for (const s of ws.build) expect(tileExists(s.face.coord, s.face.j, s.face.k)).toBe(true);
  });

  test("each step's region is non-empty, contains the centre, and never grows", () => {
    let prev = Infinity;
    for (const s of ws.build) {
      const a = polyArea(s.region);
      expect(a).toBeGreaterThan(1e-6);
      expect(pointInConvex(ws.center, s.region, 1e-9)).toBe(true);
      expect(a).toBeLessThanOrEqual(prev + 1e-9);
      prev = a;
    }
  });

  test("the final region's centroid is a different window that still accepts the whole patch", () => {
    const last = ws.build[ws.build.length - 1].region;
    let cx = 0, cy = 0;
    for (const p of last) { cx += p[0]; cy += p[1]; }
    cx /= last.length; cy /= last.length;
    // a genuinely different window centre than w0
    expect(Math.hypot(cx - ws.center[0], cy - ws.center[1])).toBeGreaterThan(1e-3);
    for (const s of ws.build) {
      for (const c of corners(s.face.coord, s.face.j, s.face.k)) {
        expect(inWindow(c, cx, cy)).toBe(true);
      }
    }
  });
});

describe("the fatal move fits with zero overlap yet empties the window region", () => {
  const ws = buildWindowStrand();

  test("the fatal tile is not a real face", () => {
    expect(tileExists(ws.wrong.face.coord, ws.wrong.face.j, ws.wrong.face.k)).toBe(false);
  });

  test("the fatal tile overlaps no built tile by real area (it fits)", () => {
    for (const s of ws.build) expect(overlaps(ws.wrong.face.phys, s.face.phys)).toBe(false);
  });

  test("the fatal tile shares a vertex with the built patch (a boundary move)", () => {
    const builtV = new Set<string>();
    for (const s of ws.build) for (const c of corners(s.face.coord, s.face.j, s.face.k)) builtV.add(c.join(","));
    const wrongV = corners(ws.wrong.face.coord, ws.wrong.face.j, ws.wrong.face.k).map((c) => (c as unknown as number[]).join(","));
    expect(wrongV.some((k) => builtV.has(k))).toBe(true);
  });

  test("placing it drives the non-empty region empty", () => {
    expect(polyArea(ws.wrong.regionBefore)).toBeGreaterThan(1e-6);
    let reg = ws.wrong.regionBefore;
    for (const c of corners(ws.wrong.face.coord, ws.wrong.face.j, ws.wrong.face.k)) reg = clipConvex(reg, acceptPentagon(c));
    expect(polyArea(reg)).toBeLessThan(1e-9);
  });

  test("the culprit pentagon alone excludes the whole region (its shadow can't fit)", () => {
    // the region lies entirely outside the culprit corner's accept pentagon
    expect(polyArea(clipConvex(ws.wrong.regionBefore, ws.wrong.accept))).toBeLessThan(1e-9);
    // and that shadow is rejected by the true window centre
    expect(pointInConvex(ws.center, ws.wrong.accept, 1e-9)).toBe(false);
  });
});
