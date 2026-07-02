import { describe, expect, test } from "bun:test";

import { tileExists } from "../../explore/lib/pentagrid";
import {
  buildOverlay,
  coincidentKeys,
  COINCIDE_TOL,
  edgeLengths,
  FIFTH,
  rotate,
  thickThinRatio,
} from "./overlay";

// This test BINDS the interference-overlay sketch to the engine. The sketch overlays
// two real Penrose tilings and may tint where they coincide. The maintainer's two
// worries are answered here: (1) both layers are genuine enumerator output, not
// hand-drawn or randomized; (2) any "agreement" tint is REAL near-coincidence under
// the current transform, never a painted-on effect. If anyone fakes a layer or a
// highlight, one of these fails.

const PHI = (1 + Math.sqrt(5)) / 2;
const o = buildOverlay();

describe("both layers are the same real enumerator patch", () => {
  test("the patch is a genuine, non-trivial Penrose patch", () => {
    expect(o.a.length).toBeGreaterThan(200);
  });

  test("layer A and layer B are the same real tiling (overlay is one patch turned over itself)", () => {
    expect(o.b.length).toBe(o.a.length);
    o.a.forEach((f, i) => {
      expect(o.b[i].key).toBe(f.key);
    });
  });

  test("every tile names a rhombus the plane actually emits (tileExists)", () => {
    for (const f of o.a) {
      expect(tileExists(f.coord, f.j, f.k)).toBe(true);
    }
  });

  test("every tile is a unit-edge rhombus (the engine's only output)", () => {
    for (const f of o.a) {
      for (const len of edgeLengths(f)) {
        expect(Math.abs(len - 1)).toBeLessThan(1e-9);
      }
    }
  });

  test("every tile is thick or thin, and the thick:thin ratio is near φ", () => {
    for (const f of o.a) {
      expect(f.type === "thick" || f.type === "thin").toBe(true);
    }
    // Over a real Penrose patch the count of thick to thin tends to φ.
    expect(Math.abs(thickThinRatio(o.a) - PHI)).toBeLessThan(0.05);
  });
});

describe("the coincidence tolerance is honest: a match means the same tile, not a neighbor", () => {
  test("COINCIDE_TOL sits well below the smallest tile-to-tile spacing in the patch", () => {
    // The closest two distinct centroids in the patch. A match within COINCIDE_TOL
    // cannot be a different nearby tile if the tolerance is comfortably under this.
    let minSpacing = Infinity;
    for (let i = 0; i < o.a.length; i++) {
      const [ax, ay] = o.a[i].centroid;
      for (let k = i + 1; k < o.a.length; k++) {
        const [bx, by] = o.a[k].centroid;
        const d = Math.hypot(ax - bx, ay - by);
        if (d < minSpacing) minSpacing = d;
      }
    }
    expect(COINCIDE_TOL).toBeLessThan(minSpacing / 2);
  });
});

describe("the agreement tint is real near-coincidence under the transform, never painted on", () => {
  // For a handful of angles across one fifth-turn, the tinted set must be exactly the
  // tiles that genuinely line up: each tinted layer-A tile has a same-kind layer-B
  // tile within COINCIDE_TOL after rotation, and no untinted tile does. Recomputing
  // the predicate independently here is the audit.
  const angles = [0, 0.2 * FIFTH, 0.475 * FIFTH, 0.5 * FIFTH, FIFTH];

  function trulyCoincident(key: string, angle: number): boolean {
    const a = o.a.find((f) => f.key === key);
    if (!a) return false;
    for (const b of o.b) {
      if (b.type !== a.type) continue;
      const [rx, ry] = rotate(b.centroid, angle);
      if (Math.hypot(a.centroid[0] - rx, a.centroid[1] - ry) <= COINCIDE_TOL) return true;
    }
    return false;
  }

  for (const angle of angles) {
    test(`every tinted tile genuinely coincides, every untinted one does not (angle ${(angle / FIFTH).toFixed(3)} of a fifth-turn)`, () => {
      const tinted = coincidentKeys(o, angle);
      for (const f of o.a) {
        expect(tinted.has(f.key)).toBe(trulyCoincident(f.key, angle));
      }
    });
  }

  test("at 0 the two coincide everywhere (identity) but the demo's motion breaks it", () => {
    // Layer B is layer A; with no rotation every tile coincides with itself. This is
    // the trivial global match, and it is the ONLY angle that gives one.
    const at0 = coincidentKeys(o, 0);
    expect(at0.size).toBe(o.a.length);
  });

  test("turned off the trivial angle, agreement is partial: islands, not a global match", () => {
    // The teaching claim made measurable: at a generic angle most tiles disagree, so
    // the two never line up everywhere. Some agree (islands), most do not (veins).
    const mid = coincidentKeys(o, 0.2 * FIFTH);
    expect(mid.size).toBeGreaterThan(0);
    expect(mid.size).toBeLessThan(o.a.length * 0.5);
  });
});
