// Face extraction from a cut-and-project vertex set, and the substitution-pairing
// ground truth used to validate it. The face condition is the naive one — a
// 2-face [n; j,k] is a tile iff all four corners n, n+e_j, n+e_k, n+e_j+e_k are
// accepted vertices — which turns out to be exact (no phantoms), validated tile-
// for-tile against the substitution. A rhombus is thick when |j−k| ∈ {1,4} (edges
// 72° apart), thin when {2,3} (144°).

import { deflate, PHI, type Pt } from "./deflate";
import { lift, type LiftedVertex } from "./bridge";

const SCALE_FOR = (levels: number) => PHI ** levels;

// key has the format "n0,n1,n2,n3,n4|jk", parsed by lib/patch.ts to recover the
// base corner n and the two axes j,k. That split is a contract dependency: if
// this format changes, patch.ts must change with it.
export type Face = { key: string; type: "thick" | "thin" };

const bump = (n: readonly number[], l: number): number[] => {
  const c = [...n];
  c[l]++;
  return c;
};

// Extract faces from a vertex set by the corner-acceptance condition.
export function extractFaces(verts: readonly LiftedVertex[]): Face[] {
  const set = new Set(verts.map((v) => v.coord.join(",")));
  const out: Face[] = [];
  for (const v of verts) {
    for (let j = 0; j < 5; j++)
      for (let k = j + 1; k < 5; k++) {
        const ej = bump(v.coord, j), ek = bump(v.coord, k), ejk = bump(ej, k);
        if (set.has(ej.join(",")) && set.has(ek.join(",")) && set.has(ejk.join(","))) {
          const d = k - j;
          out.push({ key: `${v.coord.join(",")}|${j}${k}`, type: d === 1 || d === 4 ? "thick" : "thin" });
        }
      }
  }
  return out;
}

// Ground-truth faces from the substitution: pair triangles by their shared base
// edge, map each rhombus's corners to lifted ℤ⁵ coordinates, recover (n; j,k).
export function substitutionFaces(levels: number): { faces: Face[]; verts: LiftedVertex[] } {
  const scale = SCALE_FOR(levels);
  const L = lift(levels);
  const pkey = (p: Pt) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const coordAt = new Map<string, readonly number[]>();
  for (const v of L.verts) coordAt.set(pkey(v.pos), v.coord);

  const tris = deflate(levels, 1);
  const byBase = new Map<string, { apexes: Pt[]; base: [Pt, Pt] }>();
  for (const t of tris) {
    const b: Pt = [t.b[0] * scale, t.b[1] * scale];
    const c: Pt = [t.c[0] * scale, t.c[1] * scale];
    const a: Pt = [t.a[0] * scale, t.a[1] * scale];
    const k = [pkey(b), pkey(c)].sort().join("|");
    const e = byBase.get(k) ?? byBase.set(k, { apexes: [], base: [b, c] }).get(k)!;
    e.apexes.push(a);
  }

  const faces: Face[] = [];
  for (const { apexes, base } of byBase.values()) {
    if (apexes.length !== 2) continue;
    const corners = [apexes[0], base[0], apexes[1], base[1]];
    const coords = corners.map((p) => coordAt.get(pkey(p))).filter(Boolean) as number[][];
    if (coords.length !== 4) continue;
    const varying: number[] = [];
    for (let s = 0; s < 5; s++) if (new Set(coords.map((c) => c[s])).size > 1) varying.push(s);
    if (varying.length !== 2) continue;
    const [j, k] = varying;
    const minJ = Math.min(...coords.map((c) => c[j])), minK = Math.min(...coords.map((c) => c[k]));
    const n = coords.find((c) => c[j] === minJ && c[k] === minK);
    if (!n) continue;
    const d = k - j;
    faces.push({ key: `${n.join(",")}|${j}${k}`, type: d === 1 || d === 4 ? "thick" : "thin" });
  }
  return { faces, verts: L.verts };
}

export function thickThinRatio(faces: readonly Face[]): number {
  const thick = faces.filter((f) => f.type === "thick").length;
  const thin = faces.filter((f) => f.type === "thin").length;
  return thick / thin;
}
