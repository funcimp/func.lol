import { describe, expect, test } from "bun:test";

import {
  forcedGapIndex,
  patchRhombi,
  PHI,
  type PatchRhombus,
} from "./deeperPatch";

const dist = (a: readonly [number, number], b: readonly [number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("patchRhombi", () => {
  const levels = 4;
  const radius = 10;
  let rhombi: PatchRhombus[];

  test("produces a non-trivial patch of both rhombus kinds", () => {
    rhombi = patchRhombi(levels, radius);
    expect(rhombi.length).toBeGreaterThan(40);
    expect(rhombi.some((r) => r.kind === "thick")).toBe(true);
    expect(rhombi.some((r) => r.kind === "thin")).toBe(true);
  });

  test("every rhombus has four unit-proportion edges (a real P3 rhombus)", () => {
    const r = patchRhombi(levels, radius);
    // After `levels` deflations the edge length is radius / PHI^levels. All four
    // edges of every paired rhombus share that length: the patch is a true tiling,
    // not a bag of arbitrary quads.
    const edge = radius / PHI ** levels;
    for (const { corners } of r) {
      const [a, b, c, d] = corners;
      for (const e of [dist(a, b), dist(b, c), dist(c, d), dist(d, a)]) {
        expect(e).toBeCloseTo(edge, 6);
      }
    }
  });

  test("rhombi are ordered from the seed outward", () => {
    const r = patchRhombi(levels, radius);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].radius).toBeGreaterThanOrEqual(r[i - 1].radius);
    }
    // The seed sits at the center, the rim far from it: the spread is the point.
    expect(r[0].radius).toBeLessThan(r[r.length - 1].radius);
  });
});

describe("forcedGapIndex", () => {
  test("picks a tile out near the rim, not at the seed", () => {
    const rhombi = patchRhombi(4, 10);
    const maxR = rhombi.reduce((m, r) => Math.max(m, r.radius), 0);
    const i = forcedGapIndex(rhombi, Math.PI / 5);
    expect(i).toBeGreaterThanOrEqual(0);
    // The forced gap must be far from the center where construction began: that
    // distance, between a clean seed and a distant failure, is the teaching beat.
    expect(rhombi[i].radius).toBeGreaterThan(maxR * 0.5);
  });

  test("the chosen bearing steers which side of the rim breaks", () => {
    const rhombi = patchRhombi(4, 10);
    const east = rhombi[forcedGapIndex(rhombi, 0)];
    const west = rhombi[forcedGapIndex(rhombi, Math.PI)];
    expect(east.center[0]).toBeGreaterThan(0);
    expect(west.center[0]).toBeLessThan(0);
  });

  test("empty patch yields no gap", () => {
    expect(forcedGapIndex([], 0)).toBe(-1);
  });
});
