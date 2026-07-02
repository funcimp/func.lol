import { describe, expect, test } from "bun:test";

import { internal, inWindow, index, physical } from "../../explore/lib/cap";
import { WINDOW_CENTER } from "../../explore/lib/pentagrid";
import {
  buildPatch,
  cornerCoords,
  rejectedPoints,
  windowPolygon,
  WINDOW,
} from "./cutProject";

// This test BINDS the cut-and-project sketch to the engine math. The sketch draws
// physical(coord) on the left and internal(coord) on the right for the SAME corner
// coords; a tile exists iff all four corners pass inWindow. If anyone redraws the
// picture so the dots stop being internal() of the drawn coords, or shows a
// "rejected" point that actually lands in the window, this fails.

const [VX, VY] = WINDOW_CENTER;
const patch = buildPatch();

describe("the window center the sketch uses is the explorer's", () => {
  test("WINDOW matches WINDOW_CENTER", () => {
    expect(WINDOW.vx).toBe(VX);
    expect(WINDOW.vy).toBe(VY);
  });
});

describe("every drawn tile is a real accepted tile", () => {
  test("the patch is a genuine, non-trivial Penrose patch", () => {
    expect(patch.length).toBeGreaterThan(40);
  });

  test("every corner of every tile is accepted (inWindow true)", () => {
    for (const t of patch) {
      for (const c of t.cornerCoords) {
        expect(inWindow(c, VX, VY)).toBe(true);
      }
    }
  });

  test("every accepted corner has index in {1,2,3,4}", () => {
    for (const t of patch) {
      for (const c of t.cornerCoords) {
        const i = index(c);
        expect(i).toBeGreaterThanOrEqual(1);
        expect(i).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe("the picture IS the math: drawn points are the cap.ts projections", () => {
  test("left-panel corners are exactly physical(coord)", () => {
    for (const t of patch) {
      t.cornerCoords.forEach((c, i) => {
        const [px, py] = physical(c);
        expect(t.physical[i][0]).toBe(px);
        expect(t.physical[i][1]).toBe(py);
      });
    }
  });

  test("right-panel shadows are exactly internal(coord), same coords", () => {
    for (const t of patch) {
      t.cornerCoords.forEach((c, i) => {
        const [ix, iy] = internal(c);
        expect(t.internal[i][0]).toBe(ix);
        expect(t.internal[i][1]).toBe(iy);
      });
    }
  });

  test("cornerCoords are the rhombus corners n, n+e_j, n+e_j+e_k, n+e_k", () => {
    for (const t of patch.slice(0, 5)) {
      const expected = cornerCoords(t.coord, t.j, t.k);
      expect(t.cornerCoords).toEqual(expected);
    }
  });
});

describe("every accepted shadow lands inside its index window", () => {
  // The right panel draws windowPolygon(idx) and plots internal(corner) inside it.
  // inWindow is the engine's own test; the polygon must agree with it. We assert
  // the shadow is inside the polygon for the corner's index, by ray casting.
  function inPoly(p: readonly [number, number], poly: readonly [number, number][]) {
    let inside = false;
    for (let i = 0, jj = poly.length - 1; i < poly.length; jj = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[jj];
      const hit =
        yi > p[1] !== yj > p[1] &&
        p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
      if (hit) inside = !inside;
    }
    return inside;
  }

  test("internal(corner) sits inside windowPolygon(index(corner))", () => {
    for (const t of patch) {
      for (const c of t.cornerCoords) {
        const poly = windowPolygon(index(c));
        expect(inPoly(internal(c), poly)).toBe(true);
      }
    }
  });
});

describe("rejected points the sketch shows are genuinely discarded", () => {
  const rejected = rejectedPoints();

  test("there are rejected points to show", () => {
    expect(rejected.length).toBeGreaterThan(2);
  });

  test("each rejected point fails inWindow (shadow outside the window)", () => {
    for (const r of rejected) {
      expect(inWindow(r.coord, VX, VY)).toBe(false);
    }
  });

  test("each rejected point is a candidate vertex, index in {1,2,3,4}", () => {
    for (const r of rejected) {
      const i = index(r.coord);
      expect(i).toBeGreaterThanOrEqual(1);
      expect(i).toBeLessThanOrEqual(4);
    }
  });

  test("the rejected dot the sketch plots is exactly internal(coord)", () => {
    for (const r of rejected) {
      const [ix, iy] = internal(r.coord);
      expect(r.internal[0]).toBe(ix);
      expect(r.internal[1]).toBe(iy);
    }
  });
});

describe("the shadow space is bounded (this is the whole point)", () => {
  test("every accepted shadow stays within the largest window of the center", () => {
    // Walk anywhere in the unbounded plane, the shadow never escapes ~τ of center.
    const TAU = (1 + Math.sqrt(5)) / 2;
    for (const t of patch) {
      for (const c of t.cornerCoords) {
        const [ix, iy] = internal(c);
        expect(Math.hypot(ix - VX, iy - VY)).toBeLessThan(TAU + 1e-6);
      }
    }
  });
});
