import { describe, expect, test } from "bun:test";

import {
  PHI,
  deflate,
  subdivide,
  wheel,
  colorCounts,
  legLength,
  otherLeg,
} from "./deflate";

describe("deflation produces a valid Penrose tiling at every level", () => {
  // [level, decimal precision] — the color ratio converges to φ.
  const ratioCases: [number, number][] = [[5, 2], [6, 2], [7, 3], [8, 3]];
  for (const [level, prec] of ratioCases) {
    test(`thick:thin (color) ratio → φ at level ${level}`, () => {
      const { c0, c1 } = colorCounts(deflate(level));
      expect(c0).toBeGreaterThan(0);
      expect(c1 / c0).toBeCloseTo(PHI, prec);
    });
  }

  test("every triangle stays a valid (isoceles) Robinson triangle", () => {
    for (const t of deflate(7)) {
      expect(legLength(t)).toBeCloseTo(otherLeg(t), 9);
    }
  });

  test("each level contracts tiles by exactly 1/φ (so inflation ×φ inverts it)", () => {
    let t = wheel(1);
    let prevLeg = legLength(t[0]);
    expect(prevLeg).toBeCloseTo(1, 9);
    for (let n = 1; n <= 8; n++) {
      t = subdivide(t);
      const leg = legLength(t[0]);
      expect(prevLeg / leg).toBeCloseTo(PHI, 6);
      prevLeg = leg;
    }
  });

  test("tile count grows by exactly φ² per level (the substitution eigenvalue)", () => {
    let t = wheel(1);
    let prev = t.length;
    for (let n = 1; n <= 8; n++) {
      t = subdivide(t);
      if (n >= 4) expect(t.length / prev).toBeCloseTo(PHI * PHI, 1);
      prev = t.length;
    }
  });

  test("deflation is deterministic (same input → byte-identical output)", () => {
    const a = deflate(6), b = deflate(6);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].color).toBe(b[i].color);
      expect(a[i].a[0]).toBe(b[i].a[0]);
      expect(a[i].a[1]).toBe(b[i].a[1]);
    }
  });
});
