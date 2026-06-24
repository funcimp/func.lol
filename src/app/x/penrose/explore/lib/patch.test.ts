// src/app/x/penrose/explore/lib/patch.test.ts
import { describe, expect, test } from "bun:test";

import { buildPatch, findFaceByTile } from "./patch";
import { encodeTile, decodeTile } from "./codec";

describe("buildPatch produces a render-ready patch in the pos frame", () => {
  const patch = buildPatch(6);

  test("returns faces with the level recorded", () => {
    expect(patch.level).toBe(6);
    expect(patch.faces.length).toBeGreaterThan(100);
  });

  test("every face has a 5-component address, two axes, a type, and four finite corners", () => {
    for (const f of patch.faces) {
      expect(f.coord.length).toBe(5);
      expect(f.j).toBeGreaterThanOrEqual(0);
      expect(f.j).toBeLessThan(f.k);
      expect(f.k).toBeLessThanOrEqual(4);
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
      expect(f.centroid[1]).toBeGreaterThanOrEqual(patch.bounds.minY);
      expect(f.centroid[1]).toBeLessThanOrEqual(patch.bounds.maxY);
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

// Regression guard for the pin/share cross-task bug: the address must identify
// the full tile [n; j, k], not just its base corner n. About 42% of tiles share
// an n with a neighbor, so encoding n alone reopens on the wrong rhombus.
describe("tile address round-trip distinguishes tiles that share a base corner", () => {
  const patch = buildPatch(6);

  // Find a base corner n that two faces share with different (j, k).
  const byCoord = new Map<string, typeof patch.faces>();
  for (const f of patch.faces) {
    const key = f.coord.join(",");
    const list = byCoord.get(key);
    if (list) list.push(f);
    else byCoord.set(key, [f]);
  }
  const shared = [...byCoord.values()].find((list) => list.length >= 2);

  test("the patch actually contains a shared base corner", () => {
    expect(shared).toBeDefined();
    expect(shared!.length).toBeGreaterThanOrEqual(2);
    // The two faces share n but differ in (j, k).
    expect(shared![0].coord.join(",")).toBe(shared![1].coord.join(","));
    expect(`${shared![0].j}${shared![0].k}`).not.toBe(`${shared![1].j}${shared![1].k}`);
  });

  test("each of the two faces round-trips to itself, not its neighbor", () => {
    for (const f of shared!) {
      const encoded = encodeTile({ coord: f.coord, j: f.j, k: f.k });
      const decoded = decodeTile(encoded);
      expect(decoded).not.toBeNull();
      const found = findFaceByTile(patch, decoded!);
      expect(found).not.toBeNull();
      expect(found!.key).toBe(f.key);
    }
  });
});
