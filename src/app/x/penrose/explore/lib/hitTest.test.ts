// src/app/x/penrose/explore/lib/hitTest.test.ts
import { describe, expect, test } from "bun:test";

import { buildPatch } from "./patch";
import { buildHitIndex, hitFace } from "./hitTest";

describe("hit-testing returns the tile under a point", () => {
  const patch = buildPatch(6);
  const index = buildHitIndex(patch.faces);

  test("a face centroid hits its own face", () => {
    // Sample across the patch to keep the test fast but representative.
    const step = Math.max(1, Math.floor(patch.faces.length / 200));
    for (let i = 0; i < patch.faces.length; i += step) {
      const f = patch.faces[i];
      const hit = hitFace(index, f.centroid[0], f.centroid[1]);
      expect(hit?.key).toBe(f.key);
    }
  });

  test("a point well outside the patch hits nothing", () => {
    const far = patch.bounds.maxX + 1000;
    expect(hitFace(index, far, far)).toBeNull();
  });

  test("an off-centroid interior point hits, a near-edge exterior point does not", () => {
    const f = patch.faces[Math.floor(patch.faces.length / 2)];
    const g = f.centroid;
    const c = f.corners;

    // A point pulled 40% of the way from the centroid toward a corner is still
    // strictly interior to the convex rhombus, but it is not the centroid.
    const interior: readonly [number, number] = [
      g[0] + 0.4 * (c[0][0] - g[0]),
      g[1] + 0.4 * (c[0][1] - g[1]),
    ];
    const inHit = hitFace(index, interior[0], interior[1]);
    expect(inHit?.key).toBe(f.key);

    // Step just outside an edge along its outward normal. The midpoint of edge
    // c0->c1, nudged away from the centroid, lands in the grout or a neighbor,
    // so it must not hit this face.
    const a = c[0], b = c[1];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    if ((mx - g[0]) * nx + (my - g[1]) * ny < 0) { nx = -nx; ny = -ny; }
    const len = Math.hypot(nx, ny);
    const exterior: readonly [number, number] = [
      mx + 0.05 * (nx / len),
      my + 0.05 * (ny / len),
    ];
    const outHit = hitFace(index, exterior[0], exterior[1]);
    expect(outHit?.key).not.toBe(f.key);
  });
});
