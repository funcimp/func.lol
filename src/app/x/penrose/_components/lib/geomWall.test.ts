import { describe, expect, test } from "bun:test";

import committed from "./geomWalls.json";
import {
  computeGeomWalls,
  overlapsReal,
  penetration,
  TOUCH_EPS,
  type Gap,
  type GeomWalls,
} from "./geomWall";

// This test BINDS both geometry-only sketches to the proof. The sketches render
// geomWalls.json; this test re-runs the overlap-only search that produced it and
// asserts the geometric-wall invariants. The whole point is to answer a Penrose
// expert's objection: the earlier honest sketches rejected a move by the matching
// rule (a tile fits the gap, but the rule forbids it), which a viewer can dispute.
// Here we never invoke the rule. We place the tempting tile, keep building, and
// reach a gap where every candidate OVERLAPS committed material by real area.
//
// If anyone weakens a wall back into a rule-only rejection (a "dead-end" whose
// gap actually had a non-overlapping candidate), or fakes the fit of the tempting
// move, these tests fail.

const walls: GeomWalls = computeGeomWalls();

// An overlap is real, not rounding noise, if its penetration clears 0.1. The two
// verified scenes clear it by a wide margin (min penetration 0.59 and 0.22).
const REAL_OVERLAP = 0.1;

// Every candidate on a gap overlaps committed material by a real margin: positive
// penetration above the real-overlap floor, and positive shared area. This is the
// geometric wall, asserted from the scene's own overlap evidence.
function assertGeometricWall(gaps: Gap[]) {
  expect(gaps.length).toBeGreaterThan(0);
  for (const gap of gaps) {
    expect(gap.candidates.length).toBeGreaterThan(0);
    // ZERO non-overlapping candidates: nothing fits this gap by pure geometry.
    const nonOverlapping = gap.candidates.filter(
      (c) => c.maxPenetration <= TOUCH_EPS,
    );
    expect(nonOverlapping.length).toBe(0);
    for (const c of gap.candidates) {
      // Every candidate truly overlaps, by a real margin, with real shared area.
      expect(c.maxPenetration).toBeGreaterThan(REAL_OVERLAP);
      expect(c.overlapArea).toBeGreaterThan(0);
    }
  }
}

describe("the overlap engine measures real geometry, not a rule", () => {
  test("two disjoint squares do not overlap; two coincident squares do", () => {
    const sq = (dx: number) =>
      [
        [dx, 0],
        [dx + 1, 0],
        [dx + 1, 1],
        [dx, 1],
      ] as [number, number][];
    // Edge-touching (shared side) is not overlap: that is how rhombi legitimately
    // meet. A real interior overlap is.
    expect(overlapsReal(sq(0), sq(1))).toBe(false); // touch along x=1
    expect(overlapsReal(sq(0), sq(0))).toBe(true); // coincident
    expect(penetration(sq(0), sq(0.5))).toBeCloseTo(0.5, 6);
  });
});

describe("scene A: the rigid hexagon is geometrically rigid", () => {
  const a = walls.sceneA_rigidHexagon;

  test("a six-edge hole carved from a real tiling, area ~1.54", () => {
    expect(a.holePolygon.length).toBe(6);
    expect(a.holeArea).toBeCloseTo(1.539, 2);
    expect(a.wall.length).toBeGreaterThan(100);
  });

  test("(a) the correct tile completes the hole: exactly ONE geometry-only filling", () => {
    // Rigid: the hole has a single geometry-only completion, two rhombi. The
    // correct first move is uniqueCompletion[0]; the wrong move is a DIFFERENT
    // tile on the same constrained edge.
    expect(a.uniqueCompletion.length).toBe(2);
    expect(a.geomCompletionsAfterWrong).toBe(0);
  });

  test("(b) the tempting wrong move fits the constrained edge with ZERO overlap", () => {
    // The constrained edge admits two rhombi by pure geometry; the wrong move is
    // one of them, so it genuinely fits. We reconstruct the board before the wrong
    // move and confirm the wrong tile overlaps nothing on it.
    expect(a.geomMovesOnEdge).toBe(2);
    const before = a.wall.map((t) => t.v);
    let worst = -Infinity;
    for (const v of before) {
      worst = Math.max(worst, penetration(a.wrongMove.v, v));
    }
    expect(worst).toBeLessThanOrEqual(TOUCH_EPS); // it FITS, no overlap
  });

  test("(c) after following the wrong move through, every candidate overlaps", () => {
    // The geometric wall: no candidate on any remaining gap fits. Each overlaps a
    // committed tile by a real margin. No rule is invoked anywhere.
    assertGeometricWall(a.unfillableGaps);
  });
});

describe("scene B: the expert's 'a thin fits there' case, refuted", () => {
  const b = walls.sceneB_thinRefuted;

  test("a rich 16-edge hole with a locally legal forced prefix", () => {
    expect(b.holePolygon.length).toBe(16);
    expect(b.forcedPrefix.length).toBe(7);
    expect(b.wall.length).toBeGreaterThan(100);
  });

  test("(b) the tempting THIN fits the doomed edge with ZERO overlap", () => {
    // This is the exact move the expert pointed at: a thin rhombus that visibly
    // fits the edge. It must fit by geometry (penetration below the touch epsilon
    // against the whole board), or the refutation is hollow.
    expect(b.temptingThin.type).toBe("thin");
    const board = [...b.wall, ...b.forcedPrefix].map((t) => t.v);
    let worst = -Infinity;
    for (const v of board) {
      worst = Math.max(worst, penetration(b.temptingThin.v, v));
    }
    expect(worst).toBeLessThanOrEqual(TOUCH_EPS); // it FITS, no overlap
  });

  test("(c) after placing the thin, every candidate on the next gap overlaps", () => {
    // The payoff: placing the tile the expert said fits leads, by geometry alone,
    // to a gap where nothing fits without real overlap. No rule invoked.
    expect(b.geomCompletionsAfterThin).toBe(0);
    assertGeometricWall(b.unfillableGaps);
  });
});

describe("the committed geomWalls.json matches the live computation", () => {
  // The sketches render geomWalls.json. This asserts the committed snapshot is
  // exactly what the search produces now, so the shipped data cannot drift from
  // the proof. Serialise both through JSON so number formatting is identical.
  test("geomWalls.json equals computeGeomWalls() byte-for-byte", () => {
    const live = JSON.parse(JSON.stringify(walls));
    expect(committed).toEqual(live);
  });
});
