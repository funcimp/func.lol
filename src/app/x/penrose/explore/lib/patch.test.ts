// src/app/x/penrose/explore/lib/patch.test.ts
import { describe, expect, test } from "bun:test";

import { buildPatch } from "./patch";

describe("buildPatch produces a render-ready patch in the pos frame", () => {
  const patch = buildPatch(6);

  test("returns faces with the level recorded", () => {
    expect(patch.level).toBe(6);
    expect(patch.faces.length).toBeGreaterThan(100);
  });

  test("every face has a 5-component address, a type, and four finite corners", () => {
    for (const f of patch.faces) {
      expect(f.coord.length).toBe(5);
      expect(f.type === "thick" || f.type === "thin").toBe(true);
      expect(f.corners.length).toBe(4);
      for (const [x, y] of f.corners) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
      }
    }
  });

  test("corners form a rhombus: all four edges are ~unit length", () => {
    for (const f of patch.faces) {
      const c = f.corners;
      for (let i = 0; i < 4; i++) {
        const a = c[i], b = c[(i + 1) % 4];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        expect(Math.abs(len - 1)).toBeLessThan(0.02);
      }
    }
  });

  test("centroid is the corner average and lies inside the bounds", () => {
    for (const f of patch.faces) {
      const mx = (f.corners[0][0] + f.corners[1][0] + f.corners[2][0] + f.corners[3][0]) / 4;
      const my = (f.corners[0][1] + f.corners[1][1] + f.corners[2][1] + f.corners[3][1]) / 4;
      expect(Math.abs(f.centroid[0] - mx)).toBeLessThan(1e-9);
      expect(Math.abs(f.centroid[1] - my)).toBeLessThan(1e-9);
      expect(f.centroid[0]).toBeGreaterThanOrEqual(patch.bounds.minX);
      expect(f.centroid[0]).toBeLessThanOrEqual(patch.bounds.maxX);
    }
  });

  test("thick:thin ratio approaches phi on a real patch", () => {
    const thick = patch.faces.filter((f) => f.type === "thick").length;
    const thin = patch.faces.filter((f) => f.type === "thin").length;
    expect(thick / thin).toBeGreaterThan(1.5);
    expect(thick / thin).toBeLessThan(1.75);
  });

  test("face keys are unique", () => {
    const keys = new Set(patch.faces.map((f) => f.key));
    expect(keys.size).toBe(patch.faces.length);
  });
});
