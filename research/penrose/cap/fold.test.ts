import { describe, expect, test } from "bun:test";

import { lift } from "./bridge";
import { nextCoord } from "./fold";
import type { Vec5 } from "./cap";

const PHI = (1 + Math.sqrt(5)) / 2;
const wheelKey = (pos: readonly [number, number], level: number): string => {
  const w = PHI ** level;
  return `${(pos[0] / w).toFixed(4)},${(pos[1] / w).toFixed(4)}`;
};

describe("closed-form coordinate recursion matches the edge-integration lift", () => {
  test("coord' = −A·coord + index-carry reproduces every persistent vertex exactly", () => {
    const N = 5;
    const LN = lift(N);
    const LM = lift(N + 1);
    const bandMin = Math.min(...LN.verts.map((v) => v.coord.reduce((s, x) => s + x, 0)));
    const mapM = new Map(LM.verts.map((v) => [wheelKey(v.pos, N + 1), v.coord]));

    let matched = 0, exact = 0;
    for (const v of LN.verts) {
      const cM = mapM.get(wheelKey(v.pos, N));
      if (!cM) continue;
      matched++;
      const pred = nextCoord(v.coord as Vec5, bandMin);
      if (pred.every((x, i) => x === cM[i])) exact++;
    }

    expect(matched).toBeGreaterThan(400);
    expect(exact).toBe(matched); // every persistent vertex, closed-form = ground truth
  });

  test("the recursion is exact integer arithmetic (no floating drift, any depth)", () => {
    // a hand seed through several levels stays integer and well-formed
    let c: Vec5 = [1, 0, 0, 0, 0];
    for (let i = 0; i < 30; i++) {
      c = nextCoord(c, 0);
      for (const x of c) expect(Number.isInteger(x)).toBe(true);
    }
  });
});
