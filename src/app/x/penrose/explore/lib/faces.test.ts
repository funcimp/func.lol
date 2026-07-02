import { describe, expect, test } from "bun:test";

import { extractFaces, substitutionFaces, thickThinRatio } from "./faces";

const PHI = (1 + Math.sqrt(5)) / 2;

describe("face extraction is exact against the substitution ground truth", () => {
  const { faces: subFaces, verts } = substitutionFaces(6);
  const naiveFaces = extractFaces(verts);
  const subKeys = new Set(subFaces.map((f) => f.key));
  const naiveKeys = new Set(naiveFaces.map((f) => f.key));

  test("the corner-acceptance condition has no phantom faces and misses none", () => {
    expect(subKeys.size).toBeGreaterThan(800);
    // no phantoms: every naive face is a real substitution face
    for (const f of naiveFaces) expect(subKeys.has(f.key)).toBe(true);
    // complete: every substitution face is found by the naive extractor
    for (const f of subFaces) expect(naiveKeys.has(f.key)).toBe(true);
    expect(naiveKeys.size).toBe(subKeys.size);
  });

  test("thick/thin classification agrees on every face", () => {
    const subType = new Map(subFaces.map((f) => [f.key, f.type]));
    for (const f of naiveFaces) expect(f.type).toBe(subType.get(f.key));
  });

  test("thick:thin ratio approaches φ", () => {
    expect(thickThinRatio(naiveFaces)).toBeCloseTo(PHI, 1); // within 0.05
  });
});
