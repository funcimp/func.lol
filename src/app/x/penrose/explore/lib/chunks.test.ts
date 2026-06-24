import { describe, expect, test } from "bun:test";

import { facesInViewport, GAMMA, type Rect } from "./pentagrid";
import { ChunkCache, CELL } from "./chunks";

const keys = (faces: { key: string }[]) => new Set(faces.map((f) => f.key));

describe("chunk cache reconstructs a region seam-free", () => {
  // The cache, queried over a region, must return exactly the tiles whose centroid is
  // in that region (matching a single facesInViewport call restricted by centroid).
  for (const at of [{ x: 0, y: 0 }, { x: 40, y: 40 }, { x: -45, y: 12 }]) {
    test(`region at (${at.x},${at.y}) near and far from origin`, () => {
      const view: Rect = { minX: at.x - 12, minY: at.y - 12, maxX: at.x + 12, maxY: at.y + 12 };
      const cache = new ChunkCache(GAMMA);
      const fromCache = cache.facesInView(view);
      // ground truth: one enumeration, restricted to centroids strictly inside the view
      const inView = (c: readonly [number, number]) =>
        c[0] >= view.minX && c[0] < view.maxX && c[1] >= view.minY && c[1] < view.maxY;
      const truth = facesInViewport(view, GAMMA).filter((f) => inView(f.centroid));
      const cacheInView = fromCache.filter((f) => inView(f.centroid));
      // every tile whose centroid is in the view is present exactly once, no extras
      expect(keys(cacheInView)).toEqual(keys(truth));
      expect(cacheInView.length).toBe(truth.length); // no duplicates
    });
  }
});

describe("determinism and eviction", () => {
  test("two caches over the same view return identical key sets", () => {
    const view: Rect = { minX: 20, minY: -5, maxX: 32, maxY: 7 };
    const a = new ChunkCache(GAMMA).facesInView(view);
    const b = new ChunkCache(GAMMA).facesInView(view);
    expect(keys(a)).toEqual(keys(b));
  });
  test("panning away then back yields the same faces (eviction is lossless)", () => {
    const cache = new ChunkCache(GAMMA);
    const here: Rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const far: Rect = { minX: 200, minY: 200, maxX: 210, maxY: 210 };
    const first = keys(cache.facesInView(here));
    cache.facesInView(far); // forces eviction of the first region
    const again = keys(cache.facesInView(here));
    expect(again).toEqual(first);
  });
});
