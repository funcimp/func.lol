import { describe, expect, test } from "bun:test";

import { fanTile, PHI, THICK, THIN, type Rhombus } from "./tiles";

const dist = (a: readonly [number, number], b: readonly [number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("Penrose rhombi geometry", () => {
  const cases: { name: string; tile: Rhombus; acute: number; obtuse: number }[] = [
    { name: "thick", tile: THICK, acute: 72, obtuse: 108 },
    { name: "thin", tile: THIN, acute: 36, obtuse: 144 },
  ];

  for (const { name, tile, acute, obtuse } of cases) {
    test(`${name}: interior angles are ${acute} and ${obtuse}`, () => {
      expect(tile.acute).toBe(acute);
      expect(tile.obtuse).toBe(obtuse);
      expect(tile.acute + tile.obtuse).toBe(180);
    });

    test(`${name}: all four edges have unit length`, () => {
      const [a, b, c, d] = tile.corners;
      for (const e of [dist(a, b), dist(b, c), dist(c, d), dist(d, a)]) {
        expect(e).toBeCloseTo(1, 12);
      }
    });

    test(`${name}: diagonals match the corner spans`, () => {
      const [right, top, left, bottom] = tile.corners;
      expect(dist(right, left)).toBeCloseTo(tile.longDiagonal, 12);
      expect(dist(top, bottom)).toBeCloseTo(tile.shortDiagonal, 12);
    });
  }

  test("the golden ratio hides in the diagonals", () => {
    // The whole teaching point: with a unit edge, phi is a diagonal length.
    expect(THICK.longDiagonal).toBeCloseTo(PHI, 12);
    expect(THIN.shortDiagonal).toBeCloseTo(1 / PHI, 12);
  });
});

describe("fanTile placement", () => {
  test("every placed corner is a unit-edge rhombus", () => {
    const cases = [
      { angle: 36, start: 10 },
      { angle: 72, start: -54 },
      { angle: 108, start: 200 },
      { angle: 144, start: 0 },
    ];
    for (const { angle, start } of cases) {
      const [apex, e1, far, e2] = fanTile(angle, start);
      for (const e of [
        dist(apex, e1),
        dist(e1, far),
        dist(far, e2),
        dist(e2, apex),
      ]) {
        expect(e).toBeCloseTo(1, 12);
      }
    }
  });

  test("the apex corner carries the requested interior angle", () => {
    const [apex, e1, , e2] = fanTile(72, 17);
    const va: [number, number] = [e1[0] - apex[0], e1[1] - apex[1]];
    const vb: [number, number] = [e2[0] - apex[0], e2[1] - apex[1]];
    const cos = (va[0] * vb[0] + va[1] * vb[1]) / (Math.hypot(...va) * Math.hypot(...vb));
    expect((Math.acos(cos) * 180) / Math.PI).toBeCloseTo(72, 9);
  });

  test("tiles laid head-to-tail around an apex share an edge exactly", () => {
    // This is what makes the dead-end fan a real tiling: tile n's trailing edge is
    // tile n+1's leading edge, so the patch is edge-connected with no overlap.
    let start = 0;
    const angles = [72, 36, 144, 36];
    let prevTrailingTip = fanTile(angles[0], start)[3];
    start += angles[0];
    for (let i = 1; i < angles.length; i++) {
      const tile = fanTile(angles[i], start);
      expect(dist(tile[1], prevTrailingTip)).toBeCloseTo(0, 12);
      prevTrailingTip = tile[3];
      start += angles[i];
    }
    // 72 + 36 + 144 + 36 = 288 leaves a 72 wedge: angularly a legal thick corner,
    // yet the dead-end forbids it. The gap is never an angle problem.
    expect(360 - angles.reduce((a, b) => a + b, 0)).toBe(72);
  });
});
