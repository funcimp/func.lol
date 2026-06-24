import { describe, expect, test } from "bun:test";

import {
  TAU,
  physical,
  internal,
  index,
  inWindow,
  A,
  generate,
  unitEdges,
  rhombi,
  PCOS,
  PSIN,
  type Vec5,
} from "./cap";

// A patch with a generic offset (avoids the singular symmetric center).
const VX = 0.137, VY = -0.081;
const patch = generate(6, VX, VY);

describe("inflation matrix A is exactly the φ-inflation", () => {
  const samples: Vec5[] = [
    [1, 0, 0, 0, 0],
    [0, 1, 1, 0, 0],
    [2, -1, 0, 3, -1],
    [1, 1, 1, 1, 0],
    [-2, 1, 0, 1, 1],
  ];
  for (const n of samples) {
    test(`physical ×(−φ), internal ×(1/φ), index ×2 for [${n}]`, () => {
      const [px, py] = physical(n);
      const [ax, ay] = physical(A(n));
      expect(ax).toBeCloseTo(-TAU * px, 9);
      expect(ay).toBeCloseTo(-TAU * py, 9);

      const [ix, iy] = internal(n);
      const [bx, by] = internal(A(n));
      expect(bx).toBeCloseTo(ix / TAU, 9);
      expect(by).toBeCloseTo(iy / TAU, 9);

      expect(index(A(n))).toBe(2 * index(n));
    });
  }
});

describe("the window generates a correct Penrose tiling", () => {
  test("produces a real patch, every vertex index ∈ {1,2,3,4}", () => {
    expect(patch.length).toBeGreaterThan(100);
    for (const v of patch) {
      const i = index(v.n);
      expect(i).toBeGreaterThanOrEqual(1);
      expect(i).toBeLessThanOrEqual(4);
      expect(inWindow(v.n, VX, VY)).toBe(true);
    }
  });

  test("every unit edge lies on one of the five ζ^l directions", () => {
    const dirs = [0, 1, 2, 3, 4].map((l) => ((Math.atan2(PSIN[l], PCOS[l]) * 180) / Math.PI + 180) % 180);
    const edges = unitEdges(patch);
    expect(edges.length).toBeGreaterThan(150);
    let off = 0;
    for (const [a, b] of edges) {
      const ang = ((Math.atan2(patch[b].p[1] - patch[a].p[1], patch[b].p[0] - patch[a].p[0]) * 180) / Math.PI + 180) % 180;
      const onDir = dirs.some((d) => Math.min(Math.abs(ang - d), 180 - Math.abs(ang - d)) < 0.5);
      if (!onDir) off++;
    }
    expect(off).toBe(0);
  });

  test("internal projections are bounded (cut-and-project, not a periodic grid)", () => {
    let maxR = 0;
    for (const v of patch) {
      const [ix, iy] = internal(v.n);
      maxR = Math.max(maxR, Math.hypot(ix - VX, iy - VY));
    }
    // bounded by the large pentagon (circumradius τ); never grows with the patch
    expect(maxR).toBeLessThan(TAU + 1e-6);
  });

  test("vertex count scales with area (a genuine, non-degenerate 2D tiling)", () => {
    const small = generate(4, VX, VY).length;
    const big = generate(6, VX, VY).length;
    // area grows like radius²: (6/4)² = 2.25; generous bounds for finite-patch noise
    expect(big / small).toBeGreaterThan(1.7);
    expect(big / small).toBeLessThan(2.9);
  });

  // thick:thin → φ is proven exact in faces.test.ts: the corner-acceptance face
  // condition matches the substitution tile-for-tile (no phantoms) on a large patch.
});
