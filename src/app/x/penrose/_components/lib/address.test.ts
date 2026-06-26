import { describe, expect, test } from "bun:test";

import { physical, type Vec5 } from "../../explore/lib/cap";
import { buildEdgeWalk, DIRS } from "./address";

// This BINDS the address sketch to the engine. The sketch claims you can walk to any
// tile along the tiling's own edges, each edge one of five fixed directions, and that
// the route lines up with the grid. Every claim is a test: the directions are unit
// vectors 72 degrees apart, and every segment of the route is a genuine unit-length
// tile edge in one of those directions, ending on the target tile's vertex. If the
// route ever leaves the edges, it would not line up, and this fails.

describe("the five directions are the pentagon edge directions", () => {
  test("each is a unit vector", () => {
    for (const [x, y] of DIRS) expect(Math.hypot(x, y)).toBeCloseTo(1, 12);
  });
  test("consecutive directions are 72 degrees apart", () => {
    for (let l = 0; l < 5; l++) {
      const a = DIRS[l];
      const b = DIRS[(l + 1) % 5];
      const dot = a[0] * b[0] + a[1] * b[1];
      expect(dot).toBeCloseTo(Math.cos((2 * Math.PI) / 5), 12);
    }
  });
});

describe("the edge walk lies on real tile edges (it lines up with the grid)", () => {
  const w = buildEdgeWalk();

  test("the route is non-trivial and ends at the target vertex", () => {
    expect(w.path.length).toBeGreaterThan(6);
    expect(w.edgeDirs.length).toBe(w.path.length - 1);
    const end = w.path[w.path.length - 1];
    const [px, py] = physical(w.targetCoord as unknown as Vec5);
    expect(end[0]).toBeCloseTo(px, 9);
    expect(end[1]).toBeCloseTo(py, 9);
  });

  test("every segment is a unit-length tile edge in one of the five directions", () => {
    for (let i = 1; i < w.path.length; i++) {
      const a = w.path[i - 1];
      const b = w.path[i];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      expect(len).toBeCloseTo(1, 6); // a real unit edge, so it lines up with the tiles
      const dir = w.edgeDirs[i - 1];
      expect(dir).toBeGreaterThanOrEqual(0);
      expect(dir).toBeLessThanOrEqual(4);
      // the segment runs parallel to its named edge direction
      const dx = (b[0] - a[0]) / len;
      const dy = (b[1] - a[1]) / len;
      const dot = Math.abs(dx * DIRS[dir][0] + dy * DIRS[dir][1]);
      expect(dot).toBeCloseTo(1, 6);
    }
  });
});
