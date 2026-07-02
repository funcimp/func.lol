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

  // CELL=8, KEEP_RING=1, EVICT_MARGIN=4: a 10-unit view spans 2-3 cells, kept out to
  // EVICT_MARGIN. The cache holds at most a few dozen cells, far less than the cell
  // count of a region 200 units away, so querying B must drop every A cell.
  const cellsIn = (view: Rect) => {
    const x0 = Math.floor(view.minX / CELL) - 1, x1 = Math.floor(view.maxX / CELL) + 1;
    const y0 = Math.floor(view.minY / CELL) - 1, y1 = Math.floor(view.maxY / CELL) + 1;
    return { x0, x1, y0, y1 };
  };

  test("querying a far region evicts the first, and the cache stays bounded", () => {
    const cache = new ChunkCache(GAMMA);
    const a: Rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b: Rect = { minX: 200, minY: 200, maxX: 210, maxY: 210 };
    cache.facesInView(a);
    cache.facesInView(b);
    // A's cells are gone: nothing within A's generated cell range is still cached.
    const ar = cellsIn(a);
    for (let cx = ar.x0; cx <= ar.x1; cx++)
      for (let cy = ar.y0; cy <= ar.y1; cy++)
        expect(cache["cells"].has(`${cx},${cy}`)).toBe(false);
    // The cache is bounded to roughly the B viewport plus the evict margin.
    const span = (b.maxX - b.minX) / CELL + 2 * (1 + 4) + 2;
    expect(cache.size).toBeLessThanOrEqual(Math.ceil(span) ** 2);
  });

  test("re-querying an evicted region regenerates it key-for-key", () => {
    const cache = new ChunkCache(GAMMA);
    const a: Rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const far: Rect = { minX: 200, minY: 200, maxX: 210, maxY: 210 };
    const first = keys(cache.facesInView(a));
    cache.facesInView(far); // evicts A
    const again = keys(cache.facesInView(a));
    expect(again).toEqual(first); // regeneration is lossless
  });

  test("every cell strictly inside the view survives the eviction sweep", () => {
    const cache = new ChunkCache(GAMMA);
    const view: Rect = { minX: -30, minY: -30, maxX: 30, maxY: 30 };
    cache.facesInView(view);
    // A cell (cx,cy) is strictly inside the view when its [min,max) square lies wholly
    // within the view. Those cells are drawn, so they must remain cached afterward.
    const cx0 = Math.ceil(view.minX / CELL), cx1 = Math.floor(view.maxX / CELL) - 1;
    const cy0 = Math.ceil(view.minY / CELL), cy1 = Math.floor(view.maxY / CELL) - 1;
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cy = cy0; cy <= cy1; cy++)
        expect(cache["cells"].has(`${cx},${cy}`)).toBe(true);
  });
});
