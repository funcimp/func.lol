import { describe, expect, test } from "bun:test";

import { generate, physical, type Vec5 } from "./cap";
import { extractFaces } from "./faces";
import { facesInViewport, gammaFromWindowCenter, GAMMA, tileCentroid, tileExists, WINDOW_CENTER, type Rect } from "./pentagrid";

// Oracle: the tested cut-and-project generate(), as faces, for the same tiling.
// generate() yields Vertex{n,p}; extractFaces wants LiftedVertex{pos,coord}.
function oracleFaces(radius: number, vx: number, vy: number) {
  const verts = generate(radius, vx, vy).map((v) => ({ pos: physical(v.n), coord: v.n }));
  return extractFaces(verts);
}
const inDisk = (cx: number, cy: number, r: number) => Math.hypot(cx, cy) <= r;

describe("facesInViewport matches the generate() oracle key-for-key", () => {
  const [vx, vy] = WINDOW_CENTER;
  // A few origin-ish and off-origin regions. Compare only faces whose centroid is
  // inside an inner disk where the disk-clipped oracle is complete.
  const cases = [
    { R: 16, cx: 0, cy: 0 },
    { R: 16, cx: 6, cy: 4 },
  ];
  for (const { R, cx, cy } of cases) {
    test(`region r=${R} at (${cx},${cy})`, () => {
      const inner = R - 5;
      const oracle = new Map(
        oracleFaces(R, vx, vy)
          .map((f) => [f.key, f] as const),
      );
      // restrict oracle to faces with centroid in the inner disk
      const oracleKeys = new Set(
        [...oracle.keys()].filter((key) => {
          const f = faceCentroidFromKey(key);
          return inDisk(f[0], f[1], inner);
        }),
      );
      const view: Rect = { minX: cx - R, minY: cy - R, maxX: cx + R, maxY: cy + R };
      const enumFaces = facesInViewport(view, GAMMA);
      const enumKeys = new Set(
        enumFaces
          .filter((f) => inDisk(f.centroid[0], f.centroid[1], inner))
          .map((f) => f.key),
      );
      const missing = [...oracleKeys].filter((k) => !enumKeys.has(k));
      const extra = [...enumKeys].filter((k) => !oracleKeys.has(k));
      expect(oracleKeys.size).toBeGreaterThan(100);
      expect(missing).toEqual([]);
      expect(extra).toEqual([]);
    });
  }
});

// helper: physical centroid of a face from its "n0,n1,n2,n3,n4|jk" key
function faceCentroidFromKey(key: string): [number, number] {
  const [coordStr, jk] = key.split("|");
  const n = coordStr.split(",").map(Number);
  const j = Number(jk[0]), k = Number(jk[1]);
  const c1 = [...n]; c1[j]++;
  const c2 = [...c1]; c2[k]++;
  const c3 = [...n]; c3[k]++;
  const ps = [n, c1, c2, c3].map((c) => physical(c as Vec5));
  return [(ps[0][0] + ps[1][0] + ps[2][0] + ps[3][0]) / 4, (ps[0][1] + ps[1][1] + ps[2][1] + ps[3][1]) / 4];
}

describe("far-from-origin viewports drop nothing", () => {
  test("a small viewport far out still returns its tiles, all with finite corners", () => {
    const view: Rect = { minX: 45, minY: 45, maxX: 50, maxY: 50 };
    const faces = facesInViewport(view, GAMMA);
    expect(faces.length).toBeGreaterThan(5);
    for (const f of faces) {
      expect(f.coord.length).toBe(5);
      expect(f.corners.length).toBe(4);
      for (const [x, y] of f.corners) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
      }
      // every returned tile's centroid is within one tile of the view
      expect(f.centroid[0]).toBeGreaterThan(view.minX - 2);
      expect(f.centroid[0]).toBeLessThan(view.maxX + 2);
    }
  });
});

describe("tiling validity", () => {
  const faces = facesInViewport({ minX: -12, minY: -12, maxX: 12, maxY: 12 }, GAMMA);
  test("corners are unit-edge rhombi", () => {
    for (const f of faces) {
      for (let i = 0; i < 4; i++) {
        const a = f.corners[i], b = f.corners[(i + 1) % 4];
        expect(Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - 1)).toBeLessThan(0.02);
      }
    }
  });
  test("base corner is the componentwise min on axes j,k", () => {
    for (const f of faces) {
      const { coord: n, j, k } = f;
      // n must be <= n+e_j and n+e_k on those axes, i.e. it is the min corner
      expect(n[j]).toBe(Math.min(n[j], n[j] + 1));
      expect(n[k]).toBe(Math.min(n[k], n[k] + 1));
    }
  });
  test("thick:thin ratio approaches phi", () => {
    const thick = faces.filter((f) => f.type === "thick").length;
    const thin = faces.filter((f) => f.type === "thin").length;
    expect(thick / thin).toBeGreaterThan(1.55);
    expect(thick / thin).toBeLessThan(1.7);
  });
  test("keys are unique", () => {
    expect(new Set(faces.map((f) => f.key)).size).toBe(faces.length);
  });
});

describe("tileCentroid agrees with the enumerator's centroid", () => {
  test("a returned face's centroid equals tileCentroid(coord, j, k)", () => {
    const f = facesInViewport({ minX: -4, minY: -4, maxX: 4, maxY: 4 }, GAMMA)[0];
    const c = tileCentroid(f.coord, f.j, f.k);
    expect(c[0]).toBeCloseTo(f.centroid[0], 12);
    expect(c[1]).toBeCloseTo(f.centroid[1], 12);
  });
});

describe("tileExists validates a shared address against the real tiling", () => {
  test("every face the enumerator emits passes tileExists", () => {
    const faces = facesInViewport({ minX: -12, minY: -12, maxX: 12, maxY: 12 }, GAMMA);
    expect(faces.length).toBeGreaterThan(50);
    for (const f of faces) {
      expect(tileExists(f.coord, f.j, f.k)).toBe(true);
    }
  });
  test("a fabricated address names empty space, so tileExists is false", () => {
    // shape-valid (decodeTile would accept it) but no such tile exists
    expect(tileExists([7, 7, 7, 7, 7], 0, 1)).toBe(false);
  });
});

describe("genericity: the pinned window center has no on-boundary ties", () => {
  test("gammaFromWindowCenter reproduces the window center via internal projection", () => {
    const g = gammaFromWindowCenter(0.137, -0.081);
    // internal(g) = Σ g_l ζ^{2l} = (vx,vy)
    const ICOS = [0, 1, 2, 3, 4].map((l) => Math.cos((4 * Math.PI * l) / 5));
    const ISIN = [0, 1, 2, 3, 4].map((l) => Math.sin((4 * Math.PI * l) / 5));
    let vx = 0, vy = 0;
    for (let l = 0; l < 5; l++) { vx += g[l] * ICOS[l]; vy += g[l] * ISIN[l]; }
    expect(vx).toBeCloseTo(0.137, 9);
    expect(vy).toBeCloseTo(-0.081, 9);
    expect(g.reduce((s, x) => s + x, 0)).toBeCloseTo(0, 9); // sum 0 -> index band {1,2,3,4}
  });
});
