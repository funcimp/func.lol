import { describe, expect, test } from "bun:test";

import { PHI, THICK, THIN, type Rhombus } from "./tiles";

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
