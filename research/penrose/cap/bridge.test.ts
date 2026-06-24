import { describe, expect, test } from "bun:test";

import { lift } from "./bridge";

const PHI = (1 + Math.sqrt(5)) / 2;
const L = lift(6);

describe("the substitution tiling lifts to ℤ⁵ as a cut-and-project tiling", () => {
  test("every unit edge lies on a ζ^l direction", () => {
    expect(L.verts.length).toBeGreaterThan(500);
    expect(L.badEdges).toBe(0);
  });

  test("the ℤ⁵ lift is path-independent: every rhombus closes", () => {
    expect(L.inconsistencies).toBe(0);
    expect(L.unassigned).toBe(0);
  });

  test("indices obey the de Bruijn index theorem (exactly 4 consecutive values)", () => {
    expect(L.indices.length).toBe(4);
    expect(L.indices[3] - L.indices[0]).toBe(3);
  });

  test("internal projections are bounded (cut-and-project, not a periodic grid)", () => {
    expect(L.maxInternal).toBeLessThan(PHI + 0.1);
  });

  test("the window is four pentagons with the 1:φ:φ:1 size ratio", () => {
    const radii = L.indices.map((i) => L.internalByIndex.get(i)!).sort((a, b) => a - b);
    expect(radii.length).toBe(4);
    const small = (radii[0] + radii[1]) / 2;
    const large = (radii[2] + radii[3]) / 2;
    // the two large pentagons are τ× the two small ones
    expect(large / small).toBeGreaterThan(1.5);
    expect(large / small).toBeLessThan(1.75);
  });
});
