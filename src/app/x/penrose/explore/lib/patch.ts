// src/app/x/penrose/explore/lib/patch.ts
// Turn the tested engine's faces into a render model: each rhombus carries its
// four corner positions (cyclic order) and centroid, all in the LiftedVertex.pos
// frame. Corner positions are looked up by coord key, never recomputed via
// physical(). pos and physical(coord) differ by a fixed rotation.

import { substitutionFaces } from "./faces";

export type Pt = readonly [number, number];

export type RenderFace = {
  key: string;                  // the engine Face.key, "n0,n1,n2,n3,n4|jk", the full tile identity
  coord: readonly number[];     // base-corner vertex n (length 5)
  j: number;                    // first varying axis of the rhombus (0..4)
  k: number;                    // second varying axis (j < k <= 4)
  type: "thick" | "thin";
  corners: readonly [Pt, Pt, Pt, Pt]; // cyclic: n, n+e_j, n+e_j+e_k, n+e_k
  centroid: Pt;
};

export type Patch = {
  level: number;
  faces: RenderFace[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

const bump = (n: readonly number[], l: number): number[] => {
  const c = [...n];
  c[l]++;
  return c;
};

export function buildPatch(level: number): Patch {
  const { faces, verts } = substitutionFaces(level);

  const posByCoord = new Map<string, Pt>();
  for (const v of verts) posByCoord.set(v.coord.join(","), v.pos);

  const out: RenderFace[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const f of faces) {
    const [coordStr, jk] = f.key.split("|");
    const n = coordStr.split(",").map(Number);
    const j = Number(jk[0]);
    const k = Number(jk[1]);

    // Cyclic corner coords around the rhombus.
    const cn = n;
    const cj = bump(n, j);
    const cjk = bump(cj, k);
    const ck = bump(n, k);

    const p0 = posByCoord.get(cn.join(","));
    const p1 = posByCoord.get(cj.join(","));
    const p2 = posByCoord.get(cjk.join(","));
    const p3 = posByCoord.get(ck.join(","));
    if (!p0 || !p1 || !p2 || !p3) continue; // corner-acceptance guarantees presence

    const corners: readonly [Pt, Pt, Pt, Pt] = [p0, p1, p2, p3];
    const centroid: Pt = [
      (p0[0] + p1[0] + p2[0] + p3[0]) / 4,
      (p0[1] + p1[1] + p2[1] + p3[1]) / 4,
    ];
    for (const [x, y] of corners) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    out.push({ key: f.key, coord: n, j, k, type: f.type, corners, centroid });
  }

  return { level, faces: out, bounds: { minX, minY, maxX, maxY } };
}

// Find a face by its full tile identity. A tile is the rhombus [n; j, k], not
// just its base corner n: many rhombi share an n, so matching on coord alone can
// return a neighbor. This matches every coord component and both axes. Returns
// null when no face matches (engine change or hand-edited URL), which the caller
// treats as "fall back to the seed center."
export function findFaceByTile(
  patch: Patch,
  addr: { coord: readonly number[]; j: number; k: number },
): RenderFace | null {
  return (
    patch.faces.find(
      (f) =>
        f.j === addr.j &&
        f.k === addr.k &&
        f.coord.length === addr.coord.length &&
        f.coord.every((v, i) => v === addr.coord[i]),
    ) ?? null
  );
}
