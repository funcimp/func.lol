// The Penrose matching rule, drawn as arcs. Each rhombus carries two circular
// arcs; a placement is legal iff every arc continues, in colour and position,
// across the shared edge. This module computes those arcs from real engine
// faces, so the drawing IS the rule, not an illustration of it.
//
// The rule (Grünbaum & Shephard, Tilings and Patterns §10.3, arrow form): one
// corner of each rhombus is marked, the 72° corner of the thick and the 144°
// corner of the thin. The two edges at the marked corner carry single arrows
// pointing toward it; the other two edges carry double arrows, thick pointing
// away from the unmarked corner, thin pointing toward it. de Bruijn (1981)
// proved every pentagrid tiling satisfies it.
//
// Lattice form (established empirically against the tested pentagrid engine;
// see arcs.test.ts): a face's corners carry indices s, s+1, s+1, s+2 with
// s ∈ {1,2}, and the marked corner is the unique corner of index 1 or 4, for
// both tile types. That single rule makes every shared edge in a generated
// patch agree on (arrow count, arrow head), verified key-for-key in the test.
//
// Arc encoding: the single-arrow edges meet at the marked corner, so their
// crossings sit at SINGLE_R from it and join into one arc centred there. The
// double-arrow crossings sit at DOUBLE_FROM_HEAD from each arrow head, which
// also makes one arc centred at the unmarked corner (radius 1 −
// DOUBLE_FROM_HEAD on the thick, whose arrows point away from it, and
// DOUBLE_FROM_HEAD on the thin, whose arrows point toward it). The radii are
// an aesthetic choice; the rule content is which corner and which side, and
// crossing positions agree across any legal edge because both tiles measure
// from the same arrow head.

import type { Pt, RenderFace } from "../../explore/lib/patch";

export const SINGLE_R = 0.3;
export const DOUBLE_FROM_HEAD = 0.35;

export type ArcSpec = {
  kind: "single" | "double";
  center: Pt; // the corner the arc is centred on
  radius: number; // in unit-edge lengths
  start: Pt; // endpoint on one adjacent edge
  end: Pt; // endpoint on the other adjacent edge
};

const lerp = (a: Pt, b: Pt, t: number): Pt => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

// Arcs for a rhombus given its corner cycle and which end corner (0 or 2) is
// the marked one. Corners must be cyclic with the marked/unmarked pair at
// positions 0 and 2 (the pentagrid cycle n, n+ej, n+ej+ek, n+ek has this).
export function rhombusArcs(
  corners: readonly [Pt, Pt, Pt, Pt],
  type: "thick" | "thin",
  markedEnd: 0 | 2,
): [ArcSpec, ArcSpec] {
  const m = corners[markedEnd];
  const u = corners[markedEnd === 0 ? 2 : 0];
  const [a, b] = [corners[1], corners[3]]; // the shared neighbours of m and u
  const doubleR = type === "thick" ? 1 - DOUBLE_FROM_HEAD : DOUBLE_FROM_HEAD;
  return [
    {
      kind: "single",
      center: m,
      radius: SINGLE_R,
      start: lerp(m, a, SINGLE_R),
      end: lerp(m, b, SINGLE_R),
    },
    {
      kind: "double",
      center: u,
      radius: doubleR,
      start: lerp(u, a, doubleR),
      end: lerp(u, b, doubleR),
    },
  ];
}

// The marked end for a real face: the corner of index 1 or 4. Corner indices
// are s, s+1, s+2 at cycle positions 0, {1,3}, 2, so index 1 sits at position
// 0 (when s = 1) and index 4 at position 2 (when s = 2).
export function markedEnd(face: RenderFace): 0 | 2 {
  const s = face.coord.reduce((acc, x) => acc + x, 0);
  return s === 1 ? 0 : 2;
}

export function faceArcs(face: RenderFace): [ArcSpec, ArcSpec] {
  return rhombusArcs(face.corners, face.type, markedEnd(face));
}

// Sample an arc as a polyline, sweeping the short way around the centre. The
// span is the rhombus interior angle at the centred corner, always under 180°,
// and that short sweep is the one that lies inside the tile.
export function arcPoints(arc: ArcSpec, steps = 24): Pt[] {
  const [cx, cy] = arc.center;
  const a0 = Math.atan2(arc.start[1] - cy, arc.start[0] - cx);
  let a1 = Math.atan2(arc.end[1] - cy, arc.end[0] - cx);
  if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
  if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
  const r = Math.hypot(arc.start[0] - cx, arc.start[1] - cy);
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// One crossing per edge, for the continuity test: returns, for each of the
// four edges (as lattice-vertex key pairs), the arrow state and the physical
// crossing point that the arc places on it.
export type EdgeCrossing = {
  edgeKey: string; // sorted pair of 5D vertex keys
  kind: "single" | "double";
  point: Pt;
};

export function edgeCrossings(face: RenderFace): EdgeCrossing[] {
  const lattice: number[][] = (() => {
    const c0 = [...face.coord];
    const c1 = [...c0];
    c1[face.j]++;
    const c2 = [...c1];
    c2[face.k]++;
    const c3 = [...c0];
    c3[face.k]++;
    return [c0, c1, c2, c3];
  })();
  const vkey = (c: readonly number[]) => c.join(",");
  const m = markedEnd(face);
  const u = m === 0 ? 2 : 0;
  const out: EdgeCrossing[] = [];
  const edges: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0]];
  for (const [p, q] of edges) {
    const edgeKey = [vkey(lattice[p]), vkey(lattice[q])].sort().join("|");
    if (p === m || q === m) {
      const other = p === m ? q : p;
      out.push({
        edgeKey,
        kind: "single",
        point: lerp(face.corners[m], face.corners[other], SINGLE_R),
      });
    } else {
      const other = p === u ? q : p;
      // arrow head: away from the unmarked corner on the thick, toward it on
      // the thin; the crossing sits DOUBLE_FROM_HEAD from the head either way.
      const head = face.type === "thick" ? other : u;
      const tail = head === u ? other : u;
      out.push({
        edgeKey,
        kind: "double",
        point: lerp(face.corners[head], face.corners[tail], DOUBLE_FROM_HEAD),
      });
    }
  }
  return out;
}
