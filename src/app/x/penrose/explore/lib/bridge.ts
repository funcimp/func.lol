// The bridge: lift a substitution tiling to ℤ⁵ and emit de Bruijn coordinates.
//
// Build the tiling by deflation (substitution), then integrate its edges: each
// unit edge points along some ζ^l, so walking it adds ±e_l to the ℤ⁵ coordinate.
// Starting from one vertex this assigns a ℤ⁵ point to every vertex. The lift is
// path-independent (rhombi close), the indices obey the de Bruijn index theorem
// (4 consecutive values), and the internal projections land in the cut-and-project
// window — so the substitution tiling IS a cut-and-project tiling, and the lift is
// the substitution-address → de-Bruijn-coordinate map.

import { deflate, PHI, type Pt } from "./deflate";

const Z = [0, 1, 2, 3, 4].map((l) => [Math.cos((2 * Math.PI * l) / 5), Math.sin((2 * Math.PI * l) / 5)] as const);
const ZINT = [0, 1, 2, 3, 4].map((l) => [Math.cos((4 * Math.PI * l) / 5), Math.sin((4 * Math.PI * l) / 5)] as const);

export type LiftedVertex = { pos: Pt; coord: readonly number[] };
export type Lift = {
  verts: LiftedVertex[];
  badEdges: number;        // unit edges not lying on a ζ^l direction
  inconsistencies: number; // loop-closure failures during integration
  unassigned: number;      // vertices the BFS could not reach
  indices: number[];       // sorted distinct index (Σ coord) values
  maxInternal: number;     // max |π'(coord)|
  internalByIndex: Map<number, number>; // index → max |π'| (the window pentagons)
};

function rotate(p: Pt, deg: number): Pt {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

export function lift(levels: number): Lift {
  const scale = PHI ** levels; // deflated legs → unit length
  const tris = deflate(levels, 1);

  // vertices (deduped) + unit edges (the triangle legs)
  const vmap = new Map<string, number>();
  const pos: Pt[] = [];
  const vid = (p: Pt): number => {
    const x = p[0] * scale, y = p[1] * scale;
    const k = `${x.toFixed(4)},${y.toFixed(4)}`;
    let id = vmap.get(k);
    if (id === undefined) { id = pos.length; pos.push([x, y]); vmap.set(k, id); }
    return id;
  };
  const eseen = new Set<string>();
  const edges: [number, number][] = [];
  for (const t of tris) {
    for (const [u, w] of [[t.a, t.b], [t.a, t.c]] as const) {
      const a = vid(u), b = vid(w);
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      if (!eseen.has(k)) { eseen.add(k); edges.push([a, b]); }
    }
  }

  // Rotate so edge directions align with ζ^l (edges sit at 18° + k·36°).
  const offs = edges.slice(0, 200).map(([a, b]) => {
    const ang = (Math.atan2(pos[b][1] - pos[a][1], pos[b][0] - pos[a][0]) * 180) / Math.PI;
    return ((ang % 36) + 36) % 36;
  }).sort((a, b) => a - b);
  const offset = offs[Math.floor(offs.length / 2)];
  const V = pos.map((p) => rotate(p, -offset));

  // Edge directions (l, sign): V[b] − V[a] ≈ sign · ζ^l.
  const adj: { to: number; l: number; sign: number }[][] = V.map(() => []);
  let badEdges = 0;
  for (const [a, b] of edges) {
    const dx = V[b][0] - V[a][0], dy = V[b][1] - V[a][1];
    let found: { l: number; sign: number } | null = null;
    for (let l = 0; l < 5 && !found; l++) {
      if (Math.hypot(dx - Z[l][0], dy - Z[l][1]) < 0.05) found = { l, sign: 1 };
      else if (Math.hypot(dx + Z[l][0], dy + Z[l][1]) < 0.05) found = { l, sign: -1 };
    }
    if (!found) { badEdges++; continue; }
    adj[a].push({ to: b, l: found.l, sign: found.sign });
    adj[b].push({ to: a, l: found.l, sign: -found.sign });
  }

  // BFS edge-integration from the most central vertex.
  let start = 0, best = Infinity;
  V.forEach((p, i) => { const r = Math.hypot(p[0], p[1]); if (r < best) { best = r; start = i; } });
  const coord: (number[] | null)[] = V.map(() => null);
  coord[start] = [0, 0, 0, 0, 0];
  const queue = [start];
  let inconsistencies = 0;
  while (queue.length) {
    const u = queue.shift()!;
    const cu = coord[u]!;
    for (const { to, l, sign } of adj[u]) {
      const cn = [...cu]; cn[l] += sign;
      if (coord[to] === null) { coord[to] = cn; queue.push(to); }
      else if (coord[to]!.some((v, i) => v !== cn[i])) inconsistencies++;
    }
  }

  const verts: LiftedVertex[] = [];
  const idxSet = new Set<number>();
  const internalByIndex = new Map<number, number>();
  let maxInternal = 0, unassigned = 0;
  for (let i = 0; i < V.length; i++) {
    const c = coord[i];
    if (!c) { unassigned++; continue; }
    verts.push({ pos: pos[i], coord: c });
    const idx = c.reduce((s, v) => s + v, 0);
    idxSet.add(idx);
    let ix = 0, iy = 0;
    for (let l = 0; l < 5; l++) { ix += c[l] * ZINT[l][0]; iy += c[l] * ZINT[l][1]; }
    const r = Math.hypot(ix, iy);
    maxInternal = Math.max(maxInternal, r);
    internalByIndex.set(idx, Math.max(internalByIndex.get(idx) ?? 0, r));
  }
  return { verts, badEdges, inconsistencies, unassigned, indices: [...idxSet].sort((a, b) => a - b), maxInternal, internalByIndex };
}
