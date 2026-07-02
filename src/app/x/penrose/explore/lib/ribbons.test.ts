import { describe, expect, test } from "bun:test";

import { PCOS, PSIN } from "./cap";
import { facesInViewport, GAMMA, type Rect } from "./pentagrid";
import { ribbonsForFamily } from "./ribbons";

// BIND the ribbon structure to the engine. The "hidden bands" sketch claims a Penrose
// tiling is threaded by five families of bands (one per edge direction), each a long,
// roughly one-tile-thick strip spanning the patch, and every tile belongs to exactly two
// of them. Each claim is a test here, computed from facesInViewport.

const view: Rect = { minX: -10, minY: -10, maxX: 10, maxY: 10 };
const faces = facesInViewport(view, GAMMA);
const key = (f: { key: string }) => f.key;

describe("ribbons partition each family's tiles by line level", () => {
  for (let fam = 0; fam < 5; fam++) {
    test(`family ${fam}`, () => {
      const ribs = ribbonsForFamily(faces, fam);
      expect(ribs.length).toBeGreaterThan(3);
      const incident = faces.filter((f) => f.j === fam || f.k === fam);
      // every incident tile lands in exactly one ribbon of this family
      const seen = new Set<string>();
      for (const r of ribs) {
        for (const f of r.faces) {
          expect(f.coord[fam]).toBe(r.level); // all tiles share the line level
          expect(seen.has(key(f))).toBe(false); // disjoint across levels
          seen.add(key(f));
        }
      }
      expect(seen.size).toBe(incident.length);
    });
  }
});

describe("every tile belongs to exactly two ribbons (one per axis)", () => {
  test("count membership across all families", () => {
    const count = new Map<string, number>();
    for (let fam = 0; fam < 5; fam++) {
      for (const r of ribbonsForFamily(faces, fam)) {
        for (const f of r.faces) count.set(key(f), (count.get(key(f)) ?? 0) + 1);
      }
    }
    expect(count.size).toBe(faces.length);
    for (const n of count.values()) expect(n).toBe(2);
  });
});

describe("a ribbon is a long, thin band across the patch", () => {
  test("busiest family-0 ribbon spans the patch and is ~one tile thick", () => {
    const ribs = ribbonsForFamily(faces, 0);
    const busiest = [...ribs].sort((a, b) => b.faces.length - a.faces.length)[0];
    const uf: [number, number] = [PCOS[0], PSIN[0]]; // along the family-0 line normal
    const nf: [number, number] = [-PSIN[0], PCOS[0]]; // along the ribbon (perpendicular)
    let aLo = Infinity, aHi = -Infinity, pLo = Infinity, pHi = -Infinity;
    for (const f of busiest.faces) {
      const a = f.centroid[0] * nf[0] + f.centroid[1] * nf[1]; // along the band
      const p = f.centroid[0] * uf[0] + f.centroid[1] * uf[1]; // across the band
      aLo = Math.min(aLo, a); aHi = Math.max(aHi, a);
      pLo = Math.min(pLo, p); pHi = Math.max(pHi, p);
    }
    const along = aHi - aLo, across = pHi - pLo;
    expect(along).toBeGreaterThan(across * 3); // long and thin
    expect(across).toBeLessThan(2.5); // about one tile thick
  });
});
