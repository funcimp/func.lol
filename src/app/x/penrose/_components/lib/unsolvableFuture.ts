// The "unsolvable future" proof, ported faithfully from a verified spike and run
// against the same verified legality oracle the naive solver uses. This module
// COMPUTES the scene the section-5 sketch renders; it does not author it.
//
// THE CLAIM, made precise. Carve a single closed hole out of a real deflated
// Penrose patch. The surrounding wall is legal and reachable (it is a sub-patch
// of a genuine tiling). Search the hole's fill-space EXHAUSTIVELY, rejecting a
// candidate tile ONLY when it overlaps committed material or closes a vertex to
// an arrangement outside the seven-star atlas. The result: the hole has exactly
// one completion (rigid), and exactly five legal partial fills from which the
// hole can NEVER be completed. Each dead-end picks a frontier edge that is
// permanently doomed: every tile that could seat on it either overlaps a placed
// tile or closes an illegal vertex. The rules are local; whether a legal move
// dooms you is not. Nothing local tells you which continuation survives.
//
// WHY EXHAUSTION IS A PROOF. The hole is bounded with finite area A. Every fill
// tile shares an edge with the hole region and may not overlap the wall, so all
// fill tiles lie inside the hole. Each rhombus has area >= sin(36 deg) > 0, so at
// most ceil(A / sin36) tiles fit. The search tree is finite. We also guard that
// bound explicitly: if any branch exceeds it the run is INVALID (capHit). It
// never approaches it in practice.
//
// DETERMINISM. Fixed anchor (-3.259, -1.059), fixed RHOLE = 2.3, fixed level 5,
// fixed candidate try-order (from candidates()), fixed frontier ordering. The
// scene is a pure function of nothing. The committed scene.json is its snapshot;
// unsolvableFuture.test.ts re-runs this and asserts both the snapshot match and
// the honesty invariants, so the sketch can never drift into a fake.

import {
  Board,
  candidates,
  deflatedRhombi,
  edgeKey,
  isCompleteStar,
  keyPt,
  PHI,
  type Pt,
  type Tile,
} from "./naiveSolver";

export type { Pt, Tile };

// ---------------------------------------------------------------------------
// Deterministic parameters of the proof. Do not change without re-running the
// search: the scene, the test, and the committed scene.json all depend on them.
// ---------------------------------------------------------------------------

const LEVELS = 5;
const ANCHOR: Pt = [-3.259, -1.059];
const RHOLE = 2.3;
const SIN36 = Math.sin((36 * Math.PI) / 180);

// Unit-edge tiles. deflatedRhombi(levels, radius) divides the wheel by phi each
// deflation, so seeding the wheel at phi^levels yields unit edges, matching the
// verified spike's unitTiling exactly (byte-for-byte identical geometry).
function unitTiling(levels = LEVELS): Tile[] {
  return deflatedRhombi(levels, Math.pow(PHI, levels)) as Tile[];
}

function centroid(t: Tile): Pt {
  let x = 0;
  let y = 0;
  for (const p of t.v) {
    x += p[0];
    y += p[1];
  }
  return [x / 4, y / 4];
}

function boardFrom(tiles: Tile[]): Board {
  const b = new Board();
  for (const t of tiles) b.place(t);
  return b;
}

function tileId(t: Tile): string {
  return t.v.map(keyPt).sort().join("#") + ":" + t.type;
}

// ---------------------------------------------------------------------------
// Carve the hole and extract its boundary loop.
// ---------------------------------------------------------------------------

// Remove every tile whose centroid is within RHOLE of `center`; the rest is the
// wall. A clean disk carved from a real tiling leaves a single enclosed hole.
function carve(
  tiles: Tile[],
  center: Pt,
  rhole: number,
): { removed: Tile[]; kept: Tile[] } {
  const removed: Tile[] = [];
  const kept: Tile[] = [];
  for (const t of tiles) {
    const c = centroid(t);
    const d = Math.hypot(c[0] - center[0], c[1] - center[1]);
    (d <= rhole ? removed : kept).push(t);
  }
  return { removed, kept };
}

// The hole boundary is the set of the wall's open edges that were also edges of a
// removed tile. We assemble them into one ordered loop, accepting only a single
// simple closed loop (every vertex degree 2). Returns null otherwise: we only
// keep clean holes, so a messy carve is rejected rather than silently fudged.
function holePolygon(kept: Tile[], removed: Tile[]): Pt[] | null {
  const removedEdges = new Set<string>();
  for (const t of removed) {
    for (let i = 0; i < 4; i++) {
      removedEdges.add(edgeKey(t.v[i], t.v[(i + 1) % 4]));
    }
  }
  const b = boardFrom(kept);
  const boundary: [Pt, Pt][] = [];
  for (const e of b.openEdges()) {
    if (removedEdges.has(edgeKey(e.a, e.b))) boundary.push([e.a, e.b]);
  }
  if (boundary.length < 3) return null;

  const adj = new Map<string, Pt[]>();
  const ptByKey = new Map<string, Pt>();
  for (const [a, bb] of boundary) {
    ptByKey.set(keyPt(a), a);
    ptByKey.set(keyPt(bb), bb);
    (adj.get(keyPt(a)) ?? adj.set(keyPt(a), []).get(keyPt(a))!).push(bb);
    (adj.get(keyPt(bb)) ?? adj.set(keyPt(bb), []).get(keyPt(bb))!).push(a);
  }
  for (const [, ns] of adj) if (ns.length !== 2) return null;

  const startK = [...adj.keys()].sort()[0];
  const loop: Pt[] = [ptByKey.get(startK)!];
  let prevK = "";
  let curK = startK;
  for (let i = 0; i < adj.size; i++) {
    const ns = adj.get(curK)!;
    const nextPt = keyPt(ns[0]) !== prevK ? ns[0] : ns[1];
    const nextK = keyPt(nextPt);
    if (nextK === startK) break;
    loop.push(nextPt);
    prevK = curK;
    curK = nextK;
  }
  if (loop.length !== adj.size) return null;
  return loop;
}

function inPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const hit =
      yi > p[1] !== yj > p[1] &&
      p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function polyArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

const edgeEndpoints = (key: string): [Pt, Pt] => {
  const [ka, kb] = key.split("|");
  const toPt = (s: string): Pt => {
    const [x, y] = s.split(",").map(Number);
    return [x * 1e-7, y * 1e-7];
  };
  return [toPt(ka), toPt(kb)];
};

// ---------------------------------------------------------------------------
// The exhaustive bounded search.
// ---------------------------------------------------------------------------

// Frontier edges of the hole: open edges of the current board whose midpoint
// lies inside the hole polygon. We use the polygon ONLY to choose which edges to
// fill (the hole, not the outer rim). We never use it to reject a candidate
// tile; rejection is overlap or illegal vertex alone. Sorted for determinism.
function holeFrontier(
  b: Board,
  poly: Pt[],
): { key: string; a: Pt; bb: Pt }[] {
  const out: { key: string; a: Pt; bb: Pt }[] = [];
  const seen = new Set<string>();
  for (const e of b.openEdges()) {
    const mid: Pt = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    if (inPoly(mid, poly) && !seen.has(e.key)) {
      seen.add(e.key);
      out.push({ key: e.key, a: e.a, bb: e.b });
    }
  }
  out.sort((x, y) => (x.key < y.key ? -1 : 1));
  return out;
}

// Tiles that can legally seat on edge (a, bb): no overlap, every touched vertex
// stays legal. De-duplicated by tile identity, in the fixed candidate order.
function legalFills(b: Board, a: Pt, bb: Pt): Tile[] {
  const seen = new Set<string>();
  const out: Tile[] = [];
  for (const c of candidates(a, bb)) {
    if (b.overlapsAny(c)) continue;
    if (!b.legalAfter(c).ok) continue;
    const id = tileId(c);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(c);
  }
  return out;
}

// Every distinct candidate tile on a doomed edge, with its plain verdict. This
// is the honest reason the edge can never close: each candidate either overlaps
// committed material or closes a vertex outside the atlas. There is no third
// outcome and no candidate is LEGAL.
export type Verdict =
  | { kind: "overlap"; type: "fat" | "thin" }
  | { kind: "illegal"; type: "fat" | "thin"; reason: string };

function verdictsAt(b: Board, a: Pt, bb: Pt): Verdict[] {
  const seen = new Set<string>();
  const out: Verdict[] = [];
  for (const c of candidates(a, bb)) {
    const id = tileId(c);
    if (seen.has(id)) continue;
    seen.add(id);
    if (b.overlapsAny(c)) {
      out.push({ kind: "overlap", type: c.type });
    } else {
      const leg = b.legalAfter(c);
      out.push({
        kind: "illegal",
        type: c.type,
        reason: leg.reason ?? "illegal vertex",
      });
    }
  }
  return out;
}

export type DeadEnd = {
  // Number of legal fill tiles placed before the doomed edge was reached.
  depth: number;
  // The fill tiles placed so far, in placement order. All legal, all clean.
  fill: Tile[];
  // The frontier edge that can never close.
  doomedEdge: [Pt, Pt];
  // Every candidate on that edge and why it fails. None is LEGAL.
  verdicts: Verdict[];
  // A one-line, honest reason for the caption.
  reason: string;
};

export type Scene = {
  meta: {
    levels: number;
    anchor: Pt;
    rhole: number;
    holeCenter: Pt;
    wallTiles: number;
    holeEdges: number;
    holeArea: number;
    completionTiles: number;
    completions: number;
    deadEnds: number;
    finitenessBound: number;
    capHit: boolean;
    nodes: number;
    branches: number;
  };
  wall: Tile[];
  hole: Pt[];
  completion: Tile[];
  deadEnds: DeadEnd[];
};

type SearchResult = {
  completions: number;
  firstCompletion: Tile[] | null;
  nodes: number;
  branches: number;
  capHit: boolean;
  deadEnds: { depth: number; edge: string; fill: Tile[] }[];
};

function search(fixed: Tile[], poly: Pt[]): SearchResult {
  const res: SearchResult = {
    completions: 0,
    firstCompletion: null,
    nodes: 0,
    branches: 0,
    capHit: false,
    deadEnds: [],
  };
  const maxFill = Math.ceil(polyArea(poly) / SIN36) + 4; // finiteness guard
  const extra: Tile[] = [];

  function rec(): void {
    res.nodes++;
    if (extra.length > maxFill) {
      res.capHit = true;
      return;
    }
    const b = boardFrom([...fixed, ...extra]);
    const front = holeFrontier(b, poly);
    if (front.length === 0) {
      res.completions++;
      if (!res.firstCompletion) res.firstCompletion = [...extra];
      return;
    }
    // Drive the most-constrained edge: fewest legal fills first. If any frontier
    // edge has zero legal fills, the current partial fill is a dead-end and that
    // edge is doomed.
    let chosen = front[0];
    let fills = legalFills(b, front[0].a, front[0].bb);
    for (let i = 1; i < front.length; i++) {
      const f = legalFills(b, front[i].a, front[i].bb);
      if (f.length < fills.length) {
        chosen = front[i];
        fills = f;
      }
    }
    if (fills.length === 0) {
      res.deadEnds.push({ depth: extra.length, edge: chosen.key, fill: [...extra] });
      return;
    }
    for (const cand of fills) {
      res.branches++;
      extra.push(cand);
      rec();
      extra.pop();
    }
  }
  rec();
  return res;
}

// ---------------------------------------------------------------------------
// The one public entry point: compute the whole scene deterministically.
// ---------------------------------------------------------------------------

export function computeScene(): Scene {
  const tiles = unitTiling(LEVELS);

  // Hole center: the tile centroid nearest the fixed anchor. Deterministic.
  let center: Pt = ANCHOR;
  let best = Infinity;
  for (const t of tiles) {
    const c = centroid(t);
    const d = Math.hypot(c[0] - ANCHOR[0], c[1] - ANCHOR[1]);
    if (d < best) {
      best = d;
      center = c;
    }
  }

  const { removed, kept } = carve(tiles, center, RHOLE);
  const poly = holePolygon(kept, removed);
  if (!poly) throw new Error("unsolvableFuture: hole is not a single closed loop");

  const r = search(kept, poly);
  if (!r.firstCompletion) throw new Error("unsolvableFuture: no completion found");

  const deadEnds: DeadEnd[] = r.deadEnds.map((d) => {
    const board = boardFrom([...kept, ...d.fill]);
    const [a, bb] = edgeEndpoints(d.edge);
    const verdicts = verdictsAt(board, a, bb);
    const overlaps = verdicts.filter((v) => v.kind === "overlap").length;
    const illegal = verdicts.find((v) => v.kind === "illegal") as
      | Extract<Verdict, { kind: "illegal" }>
      | undefined;
    const reason = illegal
      ? `the only tile that fits this edge closes an illegal vertex (${illegal.reason}), so this edge can never close`
      : `every tile that fits this edge overlaps a committed tile (${overlaps}), so this edge can never close`;
    return { depth: d.depth, fill: d.fill, doomedEdge: [a, bb], verdicts, reason };
  });

  return {
    meta: {
      levels: LEVELS,
      anchor: ANCHOR,
      rhole: RHOLE,
      holeCenter: center,
      wallTiles: kept.length,
      holeEdges: poly.length,
      holeArea: polyArea(poly),
      completionTiles: r.firstCompletion.length,
      completions: r.completions,
      deadEnds: deadEnds.length,
      finitenessBound: Math.ceil(polyArea(poly) / SIN36) + 4,
      capHit: r.capHit,
      nodes: r.nodes,
      branches: r.branches,
    },
    wall: kept,
    hole: poly,
    completion: r.firstCompletion,
    deadEnds,
  };
}

// True iff this dead-end's doomed edge has NO legal, non-overlapping candidate:
// every candidate either overlaps or closes a vertex not in the seven-star
// atlas. This is the honesty invariant the test asserts per dead-end. If anyone
// weakens the search into a fake (an edge that actually had a legal fill), this
// returns false and the test fails.
export function isGenuinelyDoomed(d: DeadEnd): boolean {
  if (d.verdicts.length === 0) return false;
  for (const v of d.verdicts) {
    if (v.kind === "overlap") continue;
    // An illegal verdict must close a vertex that is NOT a complete star.
    const m = v.reason.match(/\[([\d,\s]+)\]/);
    if (!m) return false; // not a vertex-closure reason: reject
    const angles = m[1].split(",").map((s) => Number(s.trim()));
    if (isCompleteStar(angles)) return false; // it WAS a legal star: not doomed
  }
  return true;
}
