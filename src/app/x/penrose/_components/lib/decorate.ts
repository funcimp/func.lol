// Matching-rule decoration for polygon patches (the geomWall scenes), where
// tiles are bare rhombi with no lattice coordinate. A single tile admits two
// markings (either end of its decoration diagonal); a valid patch forces one
// assignment through shared edges. decoratePatch propagates from a seed and
// returns the consistent choice per tile; on the geomWall scenes the result is
// unique (the other seed contradicts), which decorate.test.ts pins.
//
// This is what lets sketch 04 show the rule honestly: the wall's decoration is
// forced, and the tempting tile conflicts with it under BOTH of its markings
// (also pinned by the test), so drawing the break is reporting, not staging.

import {
  arcPoints,
  DOUBLE_FROM_HEAD,
  rhombusArcs,
  SINGLE_R,
  type ArcSpec,
} from "./arcs";

export type Pt = readonly [number, number];
export type PolyTile = { type: "fat" | "thin"; v: readonly Pt[] };

const keyPt = (p: Pt) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
const lerp = (a: Pt, b: Pt, t: number): Pt => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// The two candidate marked corners: the cyclic corner pair carrying the
// decoration angle, 72° on the fat rhombus and 144° on the thin (Grünbaum &
// Shephard's marked corners). Opposite corners share the angle, so the pair is
// (i, i+2) for i in {0,1}.
export function endPair(t: PolyTile): [number, number] {
  const want = t.type === "fat" ? 72 : 144;
  for (const i of [0, 1]) {
    const at = t.v[i];
    const a = t.v[(i + 3) % 4];
    const b = t.v[(i + 1) % 4];
    const cos =
      ((a[0] - at[0]) * (b[0] - at[0]) + (a[1] - at[1]) * (b[1] - at[1])) /
      (dist(a, at) * dist(b, at));
    const deg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    if (Math.abs(deg - want) < 1) return [i, i + 2];
  }
  throw new Error("no corner carries the decoration angle");
}

export type Crossing = { edgeKey: string; kind: "single" | "double"; point: Pt };

// The four edge crossings for a tile marked at cyclic corner position m.
// Same encoding as arcs.ts, keyed by rounded physical endpoints.
export function crossingsOf(t: PolyTile, m: number): Crossing[] {
  const u = (m + 2) % 4;
  const out: Crossing[] = [];
  for (let i = 0; i < 4; i++) {
    const p = i;
    const q = (i + 1) % 4;
    const edgeKey = [keyPt(t.v[p]), keyPt(t.v[q])].sort().join("|");
    if (p === m || q === m) {
      const other = p === m ? q : p;
      out.push({ edgeKey, kind: "single", point: lerp(t.v[m], t.v[other], SINGLE_R) });
    } else {
      const other = p === u ? q : p;
      const head = t.type === "fat" ? other : u;
      const tail = head === u ? other : u;
      out.push({ edgeKey, kind: "double", point: lerp(t.v[head], t.v[tail], DOUBLE_FROM_HEAD) });
    }
  }
  return out;
}

const agrees = (a: Crossing, b: { kind: string; point: Pt }) =>
  a.kind === b.kind && dist(a.point, b.point) < 1e-6;

// Propagate a decoration over the patch from a seed choice on tile 0.
// Returns the marked corner position per tile, or null on contradiction.
export function solveDecoration(tiles: PolyTile[], seed: 0 | 1): number[] | null {
  const pairs = tiles.map(endPair);
  const choice: number[] = tiles.map(() => -1);
  const deco = new Map<string, { kind: "single" | "double"; point: Pt }>();
  const byEdge = new Map<string, number[]>();
  tiles.forEach((t, i) => {
    for (let e = 0; e < 4; e++) {
      const k = [keyPt(t.v[e]), keyPt(t.v[(e + 1) % 4])].sort().join("|");
      byEdge.set(k, [...(byEdge.get(k) ?? []), i]);
    }
  });
  const fits = (i: number, c: 0 | 1) =>
    crossingsOf(tiles[i], pairs[i][c]).every((cr) => {
      const prev = deco.get(cr.edgeKey);
      return prev === undefined || agrees(cr, prev);
    });
  const queue: number[] = [];
  const assign = (i: number, c: 0 | 1): boolean => {
    if (!fits(i, c)) return false;
    choice[i] = pairs[i][c];
    for (const cr of crossingsOf(tiles[i], pairs[i][c])) {
      deco.set(cr.edgeKey, { kind: cr.kind, point: cr.point });
    }
    queue.push(i);
    return true;
  };
  if (!assign(0, seed)) return null;
  while (queue.length) {
    const i = queue.shift()!;
    for (let e = 0; e < 4; e++) {
      const k = [keyPt(tiles[i].v[e]), keyPt(tiles[i].v[(e + 1) % 4])].sort().join("|");
      for (const j of byEdge.get(k) ?? []) {
        if (choice[j] !== -1) continue;
        const ok0 = fits(j, 0);
        const ok1 = fits(j, 1);
        if (!ok0 && !ok1) return null;
        // assign only when forced; a both-fit tile is decided by a later edge
        if (ok0 !== ok1 && !assign(j, ok0 ? 0 : 1)) return null;
      }
    }
  }
  for (let j = 0; j < tiles.length; j++) {
    if (choice[j] !== -1) continue;
    if (!assign(j, 0) && !assign(j, 1)) return null;
  }
  return choice;
}

// The consistent decoration of a valid patch: marked corner position per tile.
export function decoratePatch(tiles: PolyTile[]): number[] {
  const solved = solveDecoration(tiles, 0) ?? solveDecoration(tiles, 1);
  if (!solved) throw new Error("patch admits no consistent decoration");
  return solved;
}

// The two rule arcs of a tile marked at cyclic position m, via the shared
// rhombus geometry (rotate the cycle so the marked corner sits at position 0).
export function tileArcs(t: PolyTile, m: number): [ArcSpec, ArcSpec] {
  const cyc = [t.v[m], t.v[(m + 1) % 4], t.v[(m + 2) % 4], t.v[(m + 3) % 4]] as const;
  return rhombusArcs(cyc as [Pt, Pt, Pt, Pt], t.type === "fat" ? "thick" : "thin", 0);
}

// Where a candidate tile breaks a committed decoration: for the given marking,
// every shared-edge crossing that disagrees, reported as both sides' points.
export function decorationBreaks(
  tile: PolyTile,
  m: number,
  committed: Map<string, { kind: "single" | "double"; point: Pt }>,
): { theirs: Pt; ours: Pt }[] {
  const out: { theirs: Pt; ours: Pt }[] = [];
  for (const cr of crossingsOf(tile, m)) {
    const prev = committed.get(cr.edgeKey);
    if (prev && !agrees(cr, prev)) out.push({ theirs: prev.point, ours: cr.point });
  }
  return out;
}

// The committed crossing map of a decorated patch, for decorationBreaks.
export function decorationMap(
  tiles: PolyTile[],
  choices: number[],
): Map<string, { kind: "single" | "double"; point: Pt }> {
  const deco = new Map<string, { kind: "single" | "double"; point: Pt }>();
  for (let i = 0; i < tiles.length; i++) {
    for (const cr of crossingsOf(tiles[i], choices[i])) {
      deco.set(cr.edgeKey, { kind: cr.kind, point: cr.point });
    }
  }
  return deco;
}

export { arcPoints };
