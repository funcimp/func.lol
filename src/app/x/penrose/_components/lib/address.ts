// Data for the "every tile knows its address" sketch (spine section 8). The address
// is the tile's ℤ⁵ coordinate. Every edge of the tiling is a unit step in one of five
// fixed directions (the tile edge directions), so you can WALK to any tile along its
// edges. This module builds the patch's edge graph and a breadth-first route from the
// origin tile to a target, so the route lies on REAL edges and lines up with the grid
// when the tiles are drawn. Bound to the engine (cap.ts, buildPatch) by address.test.ts.

import { PCOS, PSIN, type Pt } from "../../explore/lib/cap";
import { buildPatch } from "./cutProject";

// The five physical edge directions, d_l at angle 72*l degrees.
export const DIRS: Pt[] = PCOS.map((c, l) => [c, PSIN[l]] as Pt);

// ---------------------------------------------------------------------------
// The edge walk: a route to a tile along REAL tile edges, so it lines up with the
// grid when the tiles are revealed. Every tiling edge is a unit step in one of the
// five directions, so the walk is still "steps along the five directions," now along
// edges the tiles actually share. Bound by address.test.ts.
// ---------------------------------------------------------------------------

export type EdgeWalk = {
  start: { coord: number[]; p: Pt }; // the vertex nearest the origin
  targetCoord: number[]; // the tile we walk to (its anchor vertex's coordinate)
  targetType: "thick" | "thin";
  targetCorners: Pt[]; // the target tile, to highlight
  path: Pt[]; // physical points along the route, start..target vertex
  coords: number[][]; // the ℤ⁵ coord at each path vertex (length path.length)
  edgeDirs: number[]; // direction index 0..4 of each edge (length path.length - 1)
};

// Build the patch's edge graph and shortest-route to a clear, mid-distance target.
export function buildEdgeWalk(): EdgeWalk {
  const patch = buildPatch();
  const vert = new Map<string, { coord: number[]; p: Pt }>();
  const adj = new Map<string, { k: string; dir: number }[]>();
  const link = (ak: string, bk: string, dir: number) => {
    const a = adj.get(ak) ?? adj.set(ak, []).get(ak)!;
    if (!a.some((e) => e.k === bk)) a.push({ k: bk, dir });
  };
  for (const t of patch) {
    const cc = t.cornerCoords as unknown as number[][];
    const pp = t.physical;
    for (let i = 0; i < 4; i++) {
      const a = cc[i];
      const b = cc[(i + 1) % 4];
      const ak = a.join(",");
      const bk = b.join(",");
      vert.set(ak, { coord: [...a], p: [pp[i][0], pp[i][1]] });
      vert.set(bk, { coord: [...b], p: [pp[(i + 1) % 4][0], pp[(i + 1) % 4][1]] });
      let dir = 0;
      for (let l = 0; l < 5; l++) if (b[l] !== a[l]) { dir = l; break; }
      link(ak, bk, dir);
      link(bk, ak, dir);
    }
  }

  // Start: the accepted vertex nearest the physical origin.
  let startK = "";
  let bestD = Infinity;
  for (const [k, v] of vert) {
    const d = Math.hypot(v.p[0], v.p[1]);
    if (d < bestD) {
      bestD = d;
      startK = k;
    }
  }

  // Breadth-first distances and parents from the start vertex.
  const parent = new Map<string, { k: string; dir: number } | null>();
  const dist = new Map<string, number>();
  parent.set(startK, null);
  dist.set(startK, 0);
  const queue = [startK];
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    const d = dist.get(cur)!;
    for (const e of adj.get(cur) ?? []) {
      if (!dist.has(e.k)) {
        dist.set(e.k, d + 1);
        parent.set(e.k, { k: cur, dir: e.dir });
        queue.push(e.k);
      }
    }
  }

  // Target: a tile sitting well inside the patch (so it is not cut by the patch
  // edge), reaching to the side so the route spans the view. Deterministic: among
  // reachable tiles with anchor radius in [3.8, 4.8], the rightmost, tie-broken by
  // coordinate. The breadth-first route to it is a real edge path (~8-11 edges).
  let targetTile = patch[0];
  let best = -Infinity;
  for (const t of patch) {
    const k = (t.cornerCoords[0] as unknown as number[]).join(",");
    if (!dist.has(k)) continue;
    const v = vert.get(k)!;
    const r = Math.hypot(v.p[0], v.p[1]);
    if (r < 3.8 || r > 4.8) continue;
    const score = v.p[0] * 1000 + v.p[1];
    if (score > best) {
      best = score;
      targetTile = t;
    }
  }
  const targetK = (targetTile.cornerCoords[0] as unknown as number[]).join(",");

  // Reconstruct the route start..target.
  const keys: string[] = [];
  const dirs: number[] = [];
  let cur: string | undefined = targetK;
  while (cur) {
    keys.push(cur);
    const par = parent.get(cur);
    if (!par) break;
    dirs.push(par.dir);
    cur = par.k;
  }
  keys.reverse();
  dirs.reverse();

  // The engine's Math.ceil can yield -0; normalize so coords are clean integers (a
  // bare -0 would read as "-0" and breaks structural equality against +0).
  const norm = (c: readonly number[]) => c.map((v) => v + 0);

  return {
    start: vert.get(startK)!,
    targetCoord: norm(targetTile.coord as number[]),
    targetType: targetTile.type,
    targetCorners: targetTile.physical.map(([x, y]) => [x, y] as Pt),
    path: keys.map((k) => vert.get(k)!.p),
    coords: keys.map((k) => norm(vert.get(k)!.coord)),
    edgeDirs: dirs,
  };
}
