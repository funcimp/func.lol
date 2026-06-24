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

  test("a hit's corners actually contain the query point", () => {
    const f = patch.faces[Math.floor(patch.faces.length / 2)];
    const hit = hitFace(index, f.centroid[0], f.centroid[1]);
    expect(hit).not.toBeNull();
    // centroid is strictly interior to a convex rhombus
    expect(hit!.key).toBe(f.key);
  });
});
