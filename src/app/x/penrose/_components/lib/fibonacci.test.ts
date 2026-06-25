import { describe, expect, test } from "bun:test";

import {
  chain,
  internal,
  latticePoints,
  LONG,
  PHI,
  physical,
  SHORT,
  WINDOW_W,
} from "./fibonacci";

// This BINDS the Fibonacci-strip sketch to the cut-and-project theorem it claims to
// show. The sketch says: lattice points inside a strip of one-cell width project to
// a chain of exactly two lengths, in ratio phi, ordered like the Fibonacci word and
// counted toward phi. Every one of those claims is a test here. If the sketch ever
// drifts into a hand-drawn "aperiodic-looking" picture, one of these fails.

// Interior helpers: trim the outer points of a chain so the square (m,n) box edge
// can't masquerade as a tiling defect. The theorem is about the bulk.
function interior<T>(xs: T[], drop: number): T[] {
  return xs.slice(drop, xs.length - drop);
}

describe("the two lengths are phi apart, by construction", () => {
  const cases: Array<[string, number, number]> = [
    ["LONG / SHORT", LONG / SHORT, PHI],
    ["window width is phi^2 / norm", WINDOW_W, PHI * PHI / Math.sqrt(PHI * PHI + 1)],
    ["LONG is the (1,0) step", LONG, physical(1, 0)],
    ["SHORT is the (0,1) step", SHORT, physical(0, 1)],
  ];
  for (const [name, got, want] of cases) {
    test(name, () => expect(got).toBeCloseTo(want, 12));
  }

  test("the window is exactly one unit cell wide on the internal axis", () => {
    // The unit square's four corners projected onto the internal axis span WINDOW_W.
    const corners = [internal(0, 0), internal(1, 0), internal(0, 1), internal(1, 1)];
    const span = Math.max(...corners) - Math.min(...corners);
    expect(span).toBeCloseTo(WINDOW_W, 12);
  });
});

describe("a one-cell strip projects to a two-length chain", () => {
  // A handful of offsets (phases). The construction must hold for every phase, not
  // one lucky alignment.
  const offsets = [-0.7, -0.2, 0, 0.31, 0.6];

  for (const gamma of offsets) {
    test(`gamma ${gamma}: every interior gap is LONG or SHORT`, () => {
      const { segs } = chain(22, gamma);
      const inner = interior(segs, 3);
      expect(inner.length).toBeGreaterThan(8);
      for (const s of inner) {
        const gap = s.to.phys - s.from.phys;
        const isLong = Math.abs(gap - LONG) < 1e-9;
        const isShort = Math.abs(gap - SHORT) < 1e-9;
        expect(isLong || isShort).toBe(true);
      }
    });

    test(`gamma ${gamma}: consecutive accepted points differ by one unit step`, () => {
      // The heart of cut-and-project: with a one-cell window, the only steps that
      // keep you in the strip are (1,0) and (0,1). This is WHY there are two lengths.
      const { segs } = chain(22, gamma);
      for (const s of interior(segs, 3)) {
        const dm = s.to.m - s.from.m;
        const dn = s.to.n - s.from.n;
        const unit = (dm === 1 && dn === 0) || (dm === 0 && dn === 1);
        expect(unit).toBe(true);
      }
    });

    test(`gamma ${gamma}: no two short intervals are adjacent`, () => {
      // The Fibonacci word has no "SS": every short is flanked by longs.
      const { segs } = chain(22, gamma);
      const word = interior(segs, 3).map((s) => s.kind);
      for (let i = 1; i < word.length; i++) {
        expect(word[i] === "S" && word[i - 1] === "S").toBe(false);
      }
    });
  }
});

describe("the thick:thin count tends to phi", () => {
  // Same beat as the golden-ratio sketch, here from the chain itself: long:short
  // approaches phi as the sampled run grows.
  test("long:short over a long run is within 0.05 of phi", () => {
    const { segs } = chain(60, 0.123);
    const inner = interior(segs, 6);
    const longs = inner.filter((s) => s.kind === "L").length;
    const shorts = inner.filter((s) => s.kind === "S").length;
    expect(longs).toBeGreaterThan(0);
    expect(shorts).toBeGreaterThan(0);
    expect(longs / shorts).toBeCloseTo(PHI, 1);
    expect(Math.abs(longs / shorts - PHI)).toBeLessThan(0.05);
  });
});

describe("sliding the strip changes the chain but not its alphabet", () => {
  // The overlay beat in miniature: two phases give locally-identical tilings (same
  // two lengths) that are not the same sequence.
  test("two offsets yield the same lengths, different order", () => {
    const a = chain(30, 0).segs.map((s) => s.kind).join("");
    const b = chain(30, 0.5).segs.map((s) => s.kind).join("");
    expect(a).not.toBe(b);
    // both drawn from the same two-letter alphabet
    expect(/^[LS]+$/.test(a)).toBe(true);
    expect(/^[LS]+$/.test(b)).toBe(true);
  });
});

describe("acceptance is the local window test, nothing more", () => {
  test("a point is accepted iff its internal shadow is in the window", () => {
    for (const p of latticePoints(8, 0)) {
      expect(p.accepted).toBe(p.internal >= 0 && p.internal < WINDOW_W);
    }
  });
});
