import { describe, expect, test } from "bun:test";

import {
  arcLegal,
  candidates,
  deflatedRhombi,
  isCompleteStar,
  PHI,
  solveToDeadEnd,
  STARS,
  type Pt,
} from "./naiveSolver";

// This test is the honesty guarantee for the "stop tiling by hand" sketch. It
// ports two proofs from the verified spike:
//
//   (a) the legality oracle accepts a REAL deflated Penrose patch with ZERO
//       violations, and the fat:thin count ratio approaches phi. If the seven
//       stars were wrong, a real tiling would trip them.
//
//   (b) the greedy solver strands DETERMINISTICALLY at a computed dead-end, and
//       at the stranded wedge the only non-overlapping candidate is an illegal
//       thin fill whose vertex is not one of the seven stars; every other
//       candidate overlaps. So a tile fits the gap and is still forbidden. That
//       is the claim the sketch makes, proven here against the same code that
//       draws it.

const EPS = 1e-7;
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const keyPt = (p: Pt) => `${Math.round(p[0] / EPS)},${Math.round(p[1] / EPS)}`;

function interiorAngle(prev: Pt, cur: Pt, next: Pt): number {
  const u = sub(prev, cur);
  const w = sub(next, cur);
  const c = (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}
const snap = (d: number) =>
  [36, 72, 108, 144].reduce((b, a) => (Math.abs(a - d) < Math.abs(b - d) ? a : b), 36);

// Reconstruct each vertex's angular fan from a set of rhombi, so we can audit it
// against the oracle exactly as the spike's verifier did.
function vertexFans(rhombi: { v: [Pt, Pt, Pt, Pt] }[]) {
  const at = new Map<string, { angle: number; ccwStart: number }[]>();
  for (const r of rhombi) {
    for (let i = 0; i < 4; i++) {
      const cur = r.v[i];
      const prev = r.v[(i + 3) % 4];
      const next = r.v[(i + 1) % 4];
      const angle = snap(interiorAngle(prev, cur, next));
      const aPrev = Math.atan2(prev[1] - cur[1], prev[0] - cur[0]);
      const aNext = Math.atan2(next[1] - cur[1], next[0] - cur[0]);
      const norm = (x: number) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const rad = (angle * Math.PI) / 180;
      const ccwStart = norm(norm(aPrev + rad - aNext) < 1e-6 ? aPrev : aNext);
      const arr = at.get(keyPt(cur)) ?? [];
      arr.push({ angle, ccwStart });
      at.set(keyPt(cur), arr);
    }
  }
  return at;
}

function isContig(sorted: { angle: number; ccwStart: number }[]): boolean {
  for (let i = 0; i < sorted.length - 1; i++) {
    const end = sorted[i].ccwStart + (sorted[i].angle * Math.PI) / 180;
    if (
      Math.abs(((end - sorted[i + 1].ccwStart + Math.PI) % (2 * Math.PI)) - Math.PI) >
      1e-4
    ) {
      return false;
    }
  }
  return true;
}

describe("the seven-star atlas", () => {
  test("there are exactly seven stars, each closing to 360", () => {
    expect(STARS.length).toBe(7);
    for (const star of STARS) {
      expect(star.reduce((s, a) => s + a, 0)).toBe(360);
    }
  });

  test("every star is itself a complete star but a truncated arc is not", () => {
    for (const star of STARS) {
      expect(isCompleteStar(star)).toBe(true);
      // drop the last corner: no longer 360, must not read as complete
      expect(isCompleteStar(star.slice(0, -1))).toBe(false);
    }
  });

  test("[108,108,108,36] is NOT one of the seven stars", () => {
    // The dead-end's tempting fill closes to this. It must be inadmissible, or
    // the whole sketch is a lie.
    expect(isCompleteStar([108, 108, 108, 36])).toBe(false);
    expect(STARS.some((s) => s.includes(108) && s.filter((a) => a === 108).length >= 3)).toBe(
      false,
    );
  });
});

describe("(a) the oracle accepts a real deflated tiling with zero violations", () => {
  for (const levels of [3, 4, 5]) {
    test(`depth ${levels}: every vertex of a real patch is legal`, () => {
      const rhombi = deflatedRhombi(levels, 1);
      expect(rhombi.length).toBeGreaterThan(40);
      const fans = vertexFans(rhombi);

      let violComplete = 0;
      let violPartial = 0;
      for (const [, corners] of fans) {
        const sum = corners.reduce((s, c) => s + c.angle, 0);
        const sorted = [...corners].sort((a, b) => a.ccwStart - b.ccwStart);
        const angles = sorted.map((c) => c.angle);
        if (Math.abs(sum - 360) < 1) {
          if (!isCompleteStar(angles)) violComplete++;
        } else if (isContig(sorted)) {
          // contiguous boundary fan: must be a legal arc
          if (!arcLegal(angles)) violPartial++;
        }
        // non-contiguous boundary fans (a vertex with a gap on the patch rim)
        // are skipped: they are not a single arc.
      }
      expect(violComplete).toBe(0);
      expect(violPartial).toBe(0);
    });
  }

  test("fat:thin count ratio approaches phi as the patch deepens", () => {
    const ratio = (levels: number) => {
      const r = deflatedRhombi(levels, 1);
      const fat = r.filter((x) => x.type === "fat").length;
      const thin = r.filter((x) => x.type === "thin").length;
      return fat / thin;
    };
    const shallow = ratio(4);
    const deep = ratio(6);
    // both bracket phi, and deeper is closer to it than shallower.
    expect(Math.abs(deep - PHI)).toBeLessThan(Math.abs(shallow - PHI));
    expect(deep).toBeCloseTo(PHI, 1);
  });
});

describe("(b) the greedy solver strands at a computed dead-end", () => {
  const solution = solveToDeadEnd();

  test("it strands deterministically after about ten tiles, near the seed", () => {
    expect(solution.steps.length).toBe(10);
    const v = solution.deadEnd.vertex;
    const dist = Math.hypot(v[0], v[1]);
    // about two and a half tile-widths from the seed, not at the rim of a giant
    // patch: the dead-end comes quickly.
    expect(dist).toBeGreaterThan(1.5);
    expect(dist).toBeLessThan(3.5);
  });

  test("the stranded wedge is three fat corners and a 36-degree gap", () => {
    expect(solution.deadEnd.committedAngles).toEqual([108, 108, 108]);
    expect(solution.deadEnd.gapAngle).toBe(36);
  });

  test("the only non-overlapping candidate is the illegal thin fill", () => {
    const { vertex, ghost } = solution.deadEnd;
    const key = keyPt(vertex);

    // Re-derive the board state by replaying the solution, so we can enumerate
    // every candidate at the dead vertex's exposed edges, exactly as the spike's
    // scrutiny did. (We reuse candidates() and rebuild a fresh board.)
    const tiles = solution.steps.map((s) => s.tile);

    // A minimal overlap test mirroring the module's SAT (touching allowed).
    const overlap = (A: readonly Pt[], B: readonly Pt[]): boolean => {
      const norms = (P: readonly Pt[]) =>
        P.map((_, i) => {
          const e = sub(P[(i + 1) % P.length], P[i]);
          return [-e[1], e[0]] as Pt;
        });
      const proj = (P: readonly Pt[], ax: Pt): [number, number] => {
        let lo = Infinity;
        let hi = -Infinity;
        for (const p of P) {
          const d = p[0] * ax[0] + p[1] * ax[1];
          if (d < lo) lo = d;
          if (d > hi) hi = d;
        }
        return [lo, hi];
      };
      for (const ax of [...norms(A), ...norms(B)]) {
        const [a0, a1] = proj(A, ax);
        const [b0, b1] = proj(B, ax);
        if (a1 - b0 < 1e-6 || b1 - a0 < 1e-6) return false;
      }
      return true;
    };

    // Exposed edges incident to the dead vertex: owned by exactly one placed tile.
    const owners = new Map<string, { count: number; a: Pt; b: Pt }>();
    for (const t of tiles) {
      for (let i = 0; i < 4; i++) {
        const a = t.v[i];
        const b = t.v[(i + 1) % 4];
        const kp = keyPt(a);
        const kq = keyPt(b);
        const ek = kp < kq ? `${kp}|${kq}` : `${kq}|${kp}`;
        const cur = owners.get(ek) ?? { count: 0, a, b };
        cur.count++;
        owners.set(ek, cur);
      }
    }
    const incident = [...owners.values()].filter(
      (o) => o.count === 1 && (keyPt(o.a) === key || keyPt(o.b) === key),
    );
    expect(incident.length).toBeGreaterThan(0);

    let nonOverlapping = 0;
    let illegalThinFills = 0;
    for (const e of incident) {
      for (const c of candidates(e.a, e.b)) {
        if (tiles.some((u) => overlap(c.v, u.v))) continue;
        nonOverlapping++;
        // Non-overlapping means it fits the gap geometrically. It must be the
        // illegal thin fill: a tile that closes the vertex to a non-star.
        expect(c.type).toBe("thin");
        illegalThinFills++;
      }
    }
    // A tile fits the gap, so the claim is never "no tile fits".
    expect(nonOverlapping).toBeGreaterThan(0);
    expect(illegalThinFills).toBe(nonOverlapping);
    expect(ghost.type).toBe("thin");
  });

  test("the tempting fill would close the vertex to a forbidden star", () => {
    const { closesTo } = solution.deadEnd;
    expect(closesTo.slice().sort((a, b) => a - b)).toEqual([36, 108, 108, 108]);
    // The reason the rule forbids it: this arrangement is not in the atlas.
    expect(isCompleteStar(closesTo)).toBe(false);
  });
});
