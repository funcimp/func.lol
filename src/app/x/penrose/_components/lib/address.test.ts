import { describe, expect, test } from "bun:test";

import { inWindow, physical, type Vec5 } from "../../explore/lib/cap";
import { WINDOW_CENTER } from "../../explore/lib/pentagrid";
import {
  DIRS,
  pickAddressTile,
  walkExtent,
  walkPath,
} from "./address";

const [VX, VY] = WINDOW_CENTER;

// This BINDS the address sketch to the engine. The sketch claims a tile's five-integer
// address is a walk from the origin along five fixed directions that lands exactly on
// the tile's corner. Every claim is a test: the directions are unit vectors 72 degrees
// apart, the walk reconstructs physical(coord), and the chosen tile is a real accepted
// tile of the actual tiling. If the walk ever drifts from the projection, this fails.

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

describe("the address is a walk that lands on the tile", () => {
  const coords: number[][] = [
    [1, 0, 0, 0, 0],
    [1, 1, 1, 0, -1],
    [0, -1, 1, 1, 1],
    [2, 0, -1, 0, 1],
  ];

  for (const coord of coords) {
    test(`walk to [${coord.join(",")}] ends at physical(coord)`, () => {
      const path = walkPath(coord);
      const end = path[path.length - 1];
      const [px, py] = physical(coord as never);
      expect(end[0]).toBeCloseTo(px, 12);
      expect(end[1]).toBeCloseTo(py, 12);
    });

    test(`walk to [${coord.join(",")}] has one point per unit step`, () => {
      const steps = coord.reduce((a, n) => a + Math.abs(n), 0);
      expect(walkPath(coord).length).toBe(steps + 1);
    });
  }

  test("physical(coord) is exactly the sum of n_l * d_l", () => {
    for (const coord of coords) {
      let x = 0;
      let y = 0;
      for (let l = 0; l < 5; l++) {
        x += coord[l] * DIRS[l][0];
        y += coord[l] * DIRS[l][1];
      }
      const [px, py] = physical(coord as never);
      expect(x).toBeCloseTo(px, 12);
      expect(y).toBeCloseTo(py, 12);
    }
  });
});

describe("the representative is a real, accepted tile", () => {
  const tile = pickAddressTile();

  test("its anchor coord is an accepted vertex at the tiling's center", () => {
    // buildPatch only emits a tile when all four corners pass inWindow; the anchor
    // coord is one of them, so an accepted address is a real vertex of the tiling.
    expect(inWindow(tile.coord as unknown as Vec5, VX, VY)).toBe(true);
  });

  test("its groups reconstruct the coordinate exactly", () => {
    const rebuilt = [0, 0, 0, 0, 0];
    for (const g of tile.groups) rebuilt[g.l] = g.count;
    expect(rebuilt).toEqual(tile.coord);
  });

  test("the path ends at the tile's projection", () => {
    const end = tile.path[tile.path.length - 1];
    const [px, py] = physical(tile.coord as never);
    expect(end[0]).toBeCloseTo(px, 12);
    expect(end[1]).toBeCloseTo(py, 12);
  });

  test("the walk stays inside the drawn patch (bounded extent)", () => {
    expect(walkExtent(tile.coord)).toBeLessThan(4.6);
  });
});
