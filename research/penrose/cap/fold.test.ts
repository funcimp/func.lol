import { describe, expect, test } from "bun:test";

import { lift } from "./bridge";
import { nextCoord, nextCoordCanonical, goldenPoint } from "./fold";
import { A, physical, internal, type Vec5 } from "./cap";

const PHI = (1 + Math.sqrt(5)) / 2;
const ONES: Vec5 = [1, 1, 1, 1, 1];
const wheelKey = (pos: readonly [number, number], level: number): string => {
  const w = PHI ** level;
  return `${(pos[0] / w).toFixed(4)},${(pos[1] / w).toFixed(4)}`;
};

describe("[1,1,1,1,1] is the forced index-gauge direction (not a fitted constant)", () => {
  test("it is A's eigenvector for eigenvalue 2 (the index axis)", () => {
    expect([...A(ONES)]).toEqual([2, 2, 2, 2, 2]);
  });
  test("it is the kernel of both projections — adding it moves no geometry", () => {
    const [px, py] = physical(ONES);
    const [ix, iy] = internal(ONES);
    expect(Math.hypot(px, py)).toBeLessThan(1e-12);
    expect(Math.hypot(ix, iy)).toBeLessThan(1e-12);
  });
});

describe("the closed-form recursion holds at every level pair", () => {
  // Earlier the carry keyed off the source band and failed at half the pairs.
  // The forced rule keys off the target band; it must be exact everywhere.
  for (const N of [3, 4, 5, 6]) {
    test(`coord' = −A·coord + carry·ones reproduces every persistent vertex, level ${N}→${N + 1}`, () => {
      const LN = lift(N);
      const LM = lift(N + 1);
      const targetBandMin = Math.min(...LM.verts.map((v) => v.coord.reduce((s, x) => s + x, 0)));
      const mapM = new Map(LM.verts.map((v) => [wheelKey(v.pos, N + 1), v.coord]));

      let matched = 0, exact = 0;
      for (const v of LN.verts) {
        const cM = mapM.get(wheelKey(v.pos, N));
        if (!cM) continue;
        matched++;
        const pred = nextCoord(v.coord as Vec5, targetBandMin);
        if (pred.every((x, i) => x === cM[i])) exact++;
      }
      expect(matched).toBeGreaterThan(50);
      expect(exact).toBe(matched);
    });
  }
});

describe("canonical-frame rule and exactness", () => {
  test("canonical carry m = ⌈(1+2·index)/5⌉ maps {1,2,3,4} → {1,2,3,4} bijectively", () => {
    // index' = −2·index mod 5 is a permutation of {1,2,3,4}
    const out = new Set<number>();
    for (let index = 1; index <= 4; index++) {
      const m = Math.ceil((1 + 2 * index) / 5);
      const idxPrime = -2 * index + 5 * m;
      expect(idxPrime).toBeGreaterThanOrEqual(1);
      expect(idxPrime).toBeLessThanOrEqual(4);
      out.add(idxPrime);
    }
    expect(out.size).toBe(4); // a bijection, every target index hit once
  });

  test("the recursion stays exact integer to any depth", () => {
    let c: Vec5 = [1, 0, 0, 0, 0];
    for (let i = 0; i < 40; i++) {
      c = nextCoordCanonical(c);
      for (const x of c) expect(Number.isInteger(x)).toBe(true);
    }
  });
});

describe("the golden-point rule completes coordinate-space deflation", () => {
  test("every deflation-created vertex equals goldenPoint(A, l) = fold(A) + e_l", () => {
    const N = 5;
    const LN = lift(N);
    const LM = lift(N + 1);
    const targetBandMin = Math.min(...LM.verts.map((v) => v.coord.reduce((s, x) => s + x, 0)));
    const key = (r: readonly [number, number]) => `${r[0].toFixed(5)},${r[1].toFixed(5)}`;
    const rawOf = (p: readonly [number, number], level: number): [number, number] => [p[0] / PHI ** level, p[1] / PHI ** level];
    const coordM = new Map(LM.verts.map((v) => [key(rawOf(v.pos, N + 1)), v.coord]));
    const vN = LN.verts.map((v) => ({ raw: rawOf(v.pos, N), coord: v.coord }));
    const edgeLen = 1 / PHI ** N;

    let checked = 0, exact = 0;
    for (let a = 0; a < vN.length; a++) {
      for (let b = a + 1; b < vN.length; b++) {
        const dx = vN[b].raw[0] - vN[a].raw[0], dy = vN[b].raw[1] - vN[a].raw[1];
        if (Math.abs(Math.hypot(dx, dy) - edgeLen) > edgeLen * 1e-4) continue;
        const diff = vN[b].coord.map((v, i) => v - vN[a].coord[i]);
        const nz = diff.map((v, i) => [v, i] as [number, number]).filter(([v]) => v !== 0);
        if (nz.length !== 1 || Math.abs(nz[0][0]) !== 1) continue;
        const l = nz[0][1], sign = nz[0][0];
        const A0 = sign > 0 ? vN[a] : vN[b];
        const B0 = sign > 0 ? vN[b] : vN[a];
        const P: [number, number] = [A0.raw[0] + (B0.raw[0] - A0.raw[0]) / PHI, A0.raw[1] + (B0.raw[1] - A0.raw[1]) / PHI];
        const actual = coordM.get(key(P));
        if (!actual) continue;
        checked++;
        const expected = goldenPoint(A0.coord as Vec5, l, targetBandMin);
        if (expected.every((x, i) => x === actual[i])) exact++;
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(exact).toBe(checked);
  });
});
