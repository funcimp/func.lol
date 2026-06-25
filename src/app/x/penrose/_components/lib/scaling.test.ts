import { describe, expect, test } from "bun:test";

import { deflate, PHI } from "../../explore/lib/deflate";
import { substitutionFaces } from "../../explore/lib/faces";
import {
  countSeries,
  countsAt,
  halfExtent,
  hierarchyAt,
  rhombiAt,
  rhombiFromTris,
} from "./scaling";

// This test BINDS the two scaling sketches to the substitution engine. The
// golden-ratio sketch shows thick:thin counts that must equal the engine's own
// face counts at every level and must home in on phi as the level climbs. The
// hierarchy sketch must draw deflate(L) inside the real level-up tiles deflate(L-1),
// with the tile count growing by ~phi^2 per level. If anyone hand-authors the
// numbers or the supertiles, one of these fails.

const MAX = 8;

describe("the counts the golden-ratio sketch shows are the engine's faces", () => {
  // The sketch counts rhombi (the things it draws). faces.ts counts rhombi a
  // different way (lifting corners to Z^5 and pairing by axes). They must agree
  // tile for tile, or the sketch is lying about what it drew.
  for (let level = 1; level <= MAX; level++) {
    test(`thick/thin at level ${level} equals substitutionFaces`, () => {
      const c = countsAt(level);
      const sf = substitutionFaces(level).faces;
      const sThick = sf.filter((f) => f.type === "thick").length;
      const sThin = sf.filter((f) => f.type === "thin").length;
      expect(c.thick).toBe(sThick);
      expect(c.thin).toBe(sThin);
    });
  }

  test("the displayed ratio is exactly thick/thin (no fudge)", () => {
    for (const c of countSeries(MAX)) {
      expect(c.ratio).toBe(c.thick / c.thin);
    }
  });

  test("there are real tiles of both kinds to count", () => {
    for (const c of countSeries(MAX)) {
      expect(c.thick).toBeGreaterThan(0);
      expect(c.thin).toBeGreaterThan(0);
    }
  });
});

describe("the ratio homes in on the golden ratio as the level climbs", () => {
  // The teaching beat: subdivide and the fat:thin ratio approaches phi. We pin the
  // trend, not a single value (the finite patch has boundary half-rhombi that make
  // any one level a touch noisy). The gap at the top level is far smaller than the
  // gap low down, and the deepest level is genuinely close to phi.
  const series = countSeries(MAX);
  const gap = (r: number) => Math.abs(r - PHI);

  test("the gap to phi shrinks from the low levels to the top", () => {
    const low = gap(series[1].ratio); // level 2
    const top = gap(series[MAX - 1].ratio); // level MAX
    expect(top).toBeLessThan(low * 0.1);
  });

  test("the deepest level sits within 0.01 of phi", () => {
    expect(gap(series[MAX - 1].ratio)).toBeLessThan(0.01);
  });

  test("the displayed ratio rounds toward 1.618 by the deepest levels", () => {
    expect(series[MAX - 1].ratio).toBeCloseTo(PHI, 2);
  });
});

describe("the hierarchy sketch draws real engine geometry at two depths", () => {
  // The supertiles are the literal level-up tiles: deflate(L) = subdivide(deflate(L-1)),
  // so deflate(L-1) is the coarser valid tiling the small tiles compose into. We do
  // not hand-draw a single boundary.
  test("hierarchyAt(L).supers equals rhombiAt(L-1) exactly", () => {
    for (let level = 2; level <= 6; level++) {
      const h = hierarchyAt(level);
      const up = rhombiAt(level - 1);
      expect(h.supers.length).toBe(up.length);
      for (let i = 0; i < up.length; i++) {
        expect(h.supers[i].kind).toBe(up[i].kind);
        expect(h.supers[i].corners).toEqual(up[i].corners);
      }
    }
  });

  test("the small tiles are deflate(L), straight from the engine", () => {
    for (let level = 2; level <= 6; level++) {
      const h = hierarchyAt(level);
      expect(h.small).toEqual(rhombiFromTris(deflate(level, 1)));
    }
  });

  test("tile count grows by ~phi^2 per level (the substitution eigenvalue)", () => {
    // Going from supertiles (L-1) to small tiles (L) multiplies the count by the
    // substitution eigenvalue phi^2, the same growth deflate.test.ts pins on the
    // triangles, here on the complete rhombi the sketch actually draws.
    for (let level = 5; level <= MAX; level++) {
      const small = rhombiAt(level).length;
      const supers = rhombiAt(level - 1).length;
      expect(small / supers).toBeCloseTo(PHI * PHI, 0);
    }
  });
});

describe("the geometry is honest rhombi, not arbitrary quads", () => {
  test("every drawn rhombus is a unit-edge quad in apex/base/apex/base order", () => {
    // At unit wheel radius and level L the legs contract to 1/phi^L. We assert the
    // four sides are equal (a rhombus) and the diagonals are the apex-apex and
    // base-base pairs, i.e. corner 0..2 and 1..3 cross (a simple convex quad).
    const rh = rhombiAt(4);
    expect(rh.length).toBeGreaterThan(50);
    for (const r of rh.slice(0, 40)) {
      const c = r.corners;
      const side = (i: number) =>
        Math.hypot(c[(i + 1) % 4][0] - c[i][0], c[(i + 1) % 4][1] - c[i][1]);
      const s0 = side(0);
      for (let i = 1; i < 4; i++) expect(side(i)).toBeCloseTo(s0, 9);
    }
  });

  test("halfExtent frames an origin-centered patch", () => {
    expect(halfExtent(rhombiAt(3))).toBeGreaterThan(0);
    expect(halfExtent(rhombiAt(3))).toBeLessThanOrEqual(1.0001);
  });
});
