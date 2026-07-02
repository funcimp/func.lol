import { describe, expect, test } from "bun:test";

import { isCompleteStar } from "./naiveSolver";
import committed from "./scene.json";
import { firstDrift } from "./snapshotClose";
import {
  computeScene,
  isGenuinelyDoomed,
  type DeadEnd,
} from "./unsolvableFuture";

// This test BINDS the section-5 sketch to the proof. The sketch renders
// scene.json; this test re-runs the exhaustive search that produced it and
// asserts both that the committed data matches the live computation and that the
// proof's honesty invariants hold. If anyone weakens the search into an
// illustration (a "dead-end" that actually had a legal fill, a completion count
// that is not 1, a hole that is not enclosed), this test fails.
//
// The verified spike's result, reproduced here: a 410-tile wall around a single
// closed 16-edge hole; exactly ONE completion (20 tiles, rigid); exactly FIVE
// dead-ends at fill-depths 3, 4, 6, 7, 8, each a legal partial fill whose chosen
// frontier edge can never close.

const scene = computeScene();

describe("the unsolvable-future search reproduces the verified proof", () => {
  test("the wall is a 410-tile sub-patch around a single 16-edge closed hole", () => {
    expect(scene.meta.wallTiles).toBe(410);
    expect(scene.meta.holeEdges).toBe(16);
    // A single simple closed loop: the polygon has as many vertices as edges.
    expect(scene.hole.length).toBe(16);
  });

  test("the hole has EXACTLY ONE completion, rigid at 20 tiles", () => {
    expect(scene.meta.completions).toBe(1);
    expect(scene.completion.length).toBe(20);
    expect(scene.meta.completionTiles).toBe(20);
  });

  test("the search is exhaustive: the finiteness cap is never hit", () => {
    // Exhausting a finite tree is the proof. If a branch had exceeded the
    // area-based bound, the search would have leaked and the result would be
    // meaningless. It must not.
    expect(scene.meta.capHit).toBe(false);
    expect(scene.meta.finitenessBound).toBeGreaterThan(scene.completion.length);
  });

  test("there are EXACTLY FIVE dead-ends, at fill-depths 3, 4, 6, 7, 8", () => {
    expect(scene.meta.deadEnds).toBe(5);
    expect(scene.deadEnds.length).toBe(5);
    const depths = scene.deadEnds.map((d) => d.depth).sort((a, b) => a - b);
    expect(depths).toEqual([3, 4, 6, 7, 8]);
  });
});

describe("every dead-end's doomed edge is genuinely unsolvable (the honesty lock)", () => {
  // The whole job is correctness: each dead-end must be a REAL dead-end. For its
  // chosen frontier edge there must be NO legal, non-overlapping candidate. Every
  // candidate either overlaps committed material or closes a vertex outside the
  // seven-star atlas. We assert this directly per dead-end, re-deriving the
  // verdicts from the recomputed scene rather than trusting a label.
  for (const d of scene.deadEnds) {
    test(`depth ${d.depth}: no candidate on the doomed edge is legal and non-overlapping`, () => {
      // Every candidate has a verdict, and none is "legal" (there is no such
      // verdict kind: a candidate is either overlap or illegal).
      expect(d.verdicts.length).toBeGreaterThan(0);
      for (const v of d.verdicts) {
        expect(["overlap", "illegal"]).toContain(v.kind);
        if (v.kind === "illegal") {
          // An illegal candidate must close a vertex that is NOT one of the
          // seven stars. Re-check it against the atlas oracle directly.
          const angles = parseClosure(v.reason);
          expect(angles).not.toBeNull();
          expect(isCompleteStar(angles!)).toBe(false);
        }
      }
      // And the module's own invariant agrees.
      expect(isGenuinelyDoomed(d)).toBe(true);
    });
  }

  test("at least one dead-end is the sharp case: a tile FITS the gap but is illegal", () => {
    // The honest headline: a wrong but legal move dooms an edge whose only
    // non-overlapping candidate closes an illegal vertex. At least one dead-end
    // must exhibit exactly that (the proof shows three: closures
    // [144,72,36,108], [108,36,108,108], [72,72,36,36,144]).
    const sharp = scene.deadEnds.filter((d) =>
      d.verdicts.some((v) => v.kind === "illegal"),
    );
    expect(sharp.length).toBeGreaterThanOrEqual(1);
    for (const d of sharp) {
      const illegal = d.verdicts.filter((v) => v.kind === "illegal");
      // Exactly one tile fits the gap in the sharp case; it is the illegal one.
      expect(illegal.length).toBe(1);
    }
  });

  test("a faked dead-end (a doomed flag on an edge with a legal fill) is rejected", () => {
    // Guard the guard: if we hand isGenuinelyDoomed a dead-end whose only
    // "illegal" candidate actually closes a real star, it must return false. This
    // is the failure mode the honesty lock exists to catch.
    const faked: DeadEnd = {
      depth: 0,
      fill: [],
      doomedEdge: [
        [0, 0],
        [1, 0],
      ],
      // [72,72,72,72,72] is the Sun, a legal complete star. A search that called
      // this a dead-end would be lying.
      verdicts: [
        { kind: "illegal", type: "fat", reason: "closes to non-star [72,72,72,72,72]" },
      ],
      reason: "fake",
    };
    expect(isGenuinelyDoomed(faked)).toBe(false);
  });
});

describe("the committed scene.json matches the live computation", () => {
  // The sketch renders scene.json. This asserts the committed snapshot is exactly
  // what the search produces now, so the shipped data cannot drift from the proof.
  // Structure is compared exactly; trig-derived floats only within a tight tolerance,
  // because their last bit differs between CPU architectures (snapshot generated on
  // one machine, CI runs on another). See snapshotClose.ts.
  test("scene.json matches computeScene() (structure exact, floats to 1e-9)", () => {
    const live = JSON.parse(JSON.stringify(scene));
    expect(firstDrift(committed, live)).toBeNull();
  });
});

// Parse a "closes to non-star [a,b,c]" reason into its angle list. Mirrors the
// extraction in isGenuinelyDoomed so the test checks the atlas independently.
function parseClosure(reason: string): number[] | null {
  const m = reason.match(/\[([\d,\s]+)\]/);
  if (!m) return null;
  return m[1].split(",").map((s) => Number(s.trim()));
}
