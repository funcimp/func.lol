// The PURE-GEOMETRY dead-end, ported faithfully from a verified spike. This module
// answers the Penrose expert's objection head on. The earlier honest sketches
// rejected a tempting move by the MATCHING RULE: a tile fits the gap, but seating
// it would close a vertex no Penrose tiling allows. A viewer can dispute that. The
// shape fits; you have only asserted a rule. So here we never invoke the rule. We
// place the tempting tile, keep building, and reach a gap where every candidate
// rhombus OVERLAPS committed material by real area. The wall is geometry, not a
// label. No one can dispute a tile sitting on top of another tile.
//
// THE CLAIM, made precise. A candidate is rejected ONLY by real polygon overlap:
// SAT penetration above a touch epsilon, measured against every committed/placed
// tile. The seven-star atlas is never consulted. The hole-frontier selection
// (which open edges still face the hole) is kept only to decide what still needs
// filling; it never rejects a tile. A tile that fits with zero overlap is always
// accepted, even if it is matching-illegal.
//
// WHY EXHAUSTION IS A PROOF. The hole is bounded with finite area A. Every fill
// tile shares an edge with the hole frontier and may not overlap the wall, so all
// fill tiles lie inside the hole (a tile crossing the wall would overlap a wall
// tile and be rejected). Each rhombus has area >= sin(36 deg) > 0, so at most
// ceil(A / sin36) tiles fit. The search tree is finite. We guard that bound
// explicitly: if a branch exceeds it the run is INVALID (capHit). It never does.
//
// TWO SCENES.
//   A) A geometrically RIGID hexagon hole: exactly ONE geometry-only filling (two
//      rhombi). The constrained edge admits two rhombi by pure geometry; one
//      completes, the other (a fat-108 move) strands. After the wrong move every
//      candidate on the next gap overlaps. A piece fits and still strands you.
//   B) The expert's exact case, refuted. A rich 16-edge hole. On a doomed frontier
//      edge a THIN rhombus does fit with zero overlap (the move the expert pointed
//      at). Place it. The geometry-only exhaustive search then finds ZERO
//      completion: the very next gap admits no rhombus without real overlap.
//
// DETERMINISM. Fixed level 5, fixed anchors, fixed RHOLE per scene, fixed
// candidate try-order, fixed frontier ordering. The scene is a pure function of
// nothing. The committed geomWalls.json is its snapshot; geomWall.test.ts re-runs
// this and asserts both the snapshot match and the geometric-wall invariants, so
// the sketches can never drift into a fake or back into a rule-only rejection.

import {
  Board,
  candidates,
  keyPt,
  type Pt,
  type Tile,
} from "./naiveSolver";
import {
  carve,
  centroid,
  computeScene,
  holePolygon,
  inPoly,
  polyArea,
  unitTiling,
} from "./unsolvableFuture";
import {
  overlapArea,
  overlapsReal,
  penetration,
  TOUCH_EPS,
} from "./overlap";

export type { Pt, Tile };
// Re-export the overlap engine so callers (and the proof test) get one entry
// point. The engine itself lives in overlap.ts, dependency-free, so the sketches
// can import it alone without pulling the deflation/search code into the browser.
export { overlapArea, overlapPolygon, overlapsReal, penetration, TOUCH_EPS } from "./overlap";

const SIN36 = Math.sin((36 * Math.PI) / 180);

// Deterministic anchors. Scene A's hexagon center is the tile centroid nearest
// this point; scene B reuses the section-5 hole exactly (same anchor, RHOLE 2.3).
const LEVELS = 5;
const SCENE_A_ANCHOR: Pt = [-0.769, 1.868];
const SCENE_A_RHOLE = 0.85;

// ---------------------------------------------------------------------------
// Board and frontier helpers. The overlap engine (penetration / overlapsReal /
// overlapArea) lives in overlap.ts and is imported above: one auditable test,
// independent of the board's private SAT.
// ---------------------------------------------------------------------------

function boardFrom(tiles: Tile[]): Board {
  const b = new Board();
  for (const t of tiles) b.place(t);
  return b;
}

function tileId(t: Tile): string {
  return t.v.map(keyPt).sort().join("#") + ":" + t.type;
}

// The sorted-first endpoint key of a frontier edge, the canonical reference vertex
// for naming a tile's corner there. The edge key is keyPt(a)|keyPt(b) sorted, so
// this is its first half. Naming the corner from a fixed endpoint keeps the label
// stable regardless of which way the frontier walk hands us the edge.
function edgeKeyHead(a: Pt, bb: Pt): string {
  const ka = keyPt(a);
  const kb = keyPt(bb);
  return ka < kb ? ka : kb;
}

// The corner angle of tile t at the lattice vertex with key vKey, in degrees.
function cornerAt(t: Tile, vKey: string): number | null {
  for (let i = 0; i < 4; i++) {
    if (keyPt(t.v[i]) !== vKey) continue;
    const cur = t.v[i];
    const prev = t.v[(i + 3) % 4];
    const next = t.v[(i + 1) % 4];
    const u: Pt = [prev[0] - cur[0], prev[1] - cur[1]];
    const w: Pt = [next[0] - cur[0], next[1] - cur[1]];
    const c =
      (u[0] * w[0] + u[1] * w[1]) /
      (Math.hypot(u[0], u[1]) * Math.hypot(w[0], w[1]));
    return Math.round((Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI);
  }
  return null;
}

// Frontier: open edges whose inward midpoint lies in the hole. Used ONLY to pick
// which edges still need filling, never to reject a candidate tile. Sorted for
// determinism.
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

// Geometry-only legal fills on an edge: reject ONLY by real overlap with the full
// board. No matching-rule test. De-duplicated, in the fixed candidate order.
function geomFills(allTiles: Tile[], a: Pt, bb: Pt): Tile[] {
  const seen = new Set<string>();
  const out: Tile[] = [];
  for (const c of candidates(a, bb)) {
    let bad = false;
    for (const u of allTiles) {
      if (overlapsReal(c.v, u.v)) {
        bad = true;
        break;
      }
    }
    if (bad) continue;
    const id = tileId(c);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The geometry-only exhaustive search. Returns the number of completions and the
// first one found. countAll enumerates every completion; else it stops at first.
// ---------------------------------------------------------------------------

type GeomResult = {
  completions: number;
  firstCompletion: Tile[] | null;
  capHit: boolean;
};

function geomSearch(fixed: Tile[], poly: Pt[], countAll = false): GeomResult {
  const res: GeomResult = {
    completions: 0,
    firstCompletion: null,
    capHit: false,
  };
  const maxFill = Math.ceil(polyArea(poly) / SIN36) + 6;
  const extra: Tile[] = [];

  function rec(): boolean {
    if (extra.length > maxFill) {
      res.capHit = true;
      return false;
    }
    const all = [...fixed, ...extra];
    const b = boardFrom(all);
    const front = holeFrontier(b, poly);
    if (front.length === 0) {
      res.completions++;
      if (!res.firstCompletion) res.firstCompletion = [...extra];
      return !countAll;
    }
    // Drive the most-constrained edge: fewest geometric fills first.
    let chosen = front[0];
    let fills = geomFills(all, front[0].a, front[0].bb);
    for (let i = 1; i < front.length; i++) {
      const f = geomFills(all, front[i].a, front[i].bb);
      if (f.length < fills.length) {
        chosen = front[i];
        fills = f;
      }
      if (fills.length === 0) break;
    }
    if (fills.length === 0) return false; // geometric dead-end: no fill here
    void chosen;
    for (const cand of fills) {
      extra.push(cand);
      if (rec()) return true;
      extra.pop();
    }
    return false;
  }
  rec();
  return res;
}

// ---------------------------------------------------------------------------
// A serialisable candidate on an unfillable gap, with its real overlap evidence.
// ---------------------------------------------------------------------------

export type GapCandidate = {
  type: "fat" | "thin";
  corner: number | null;
  v: [Pt, Pt, Pt, Pt];
  // The worst penetration (smallest separating distance) against the board. Above
  // TOUCH_EPS means this candidate truly overlaps committed material.
  maxPenetration: number;
  // The real shared area against the board. Zero would mean it fits; here every
  // candidate's value is positive, which is the whole point.
  overlapArea: number;
};

export type Gap = {
  edge: [Pt, Pt];
  candidates: GapCandidate[];
};

// Enumerate every distinct candidate on a gap edge and, for each, the worst real
// overlap against the board. This is the adversarial "no piece fits" evidence:
// every candidate carries a positive penetration and a positive shared area.
function enumGap(all: Tile[], a: Pt, bb: Pt): Gap {
  // Name each candidate's corner from the edge endpoint `a` handed to us by the
  // frontier walk. (The frontier orders edges deterministically, so this is
  // stable.) It is a descriptive label on the overlap evidence, not load-bearing.
  const ka = keyPt(a);
  const seen = new Set<string>();
  const cands: GapCandidate[] = [];
  for (const c of candidates(a, bb)) {
    const id = tileId(c);
    if (seen.has(id)) continue;
    seen.add(id);
    let maxPen = -Infinity;
    let maxArea = 0;
    for (const u of all) {
      const pen = penetration(c.v, u.v);
      const ar = pen > TOUCH_EPS ? overlapArea(c.v, u.v) : 0;
      if (pen > maxPen) maxPen = pen;
      if (ar > maxArea) maxArea = ar;
    }
    cands.push({
      type: c.type,
      corner: cornerAt(c, ka),
      v: c.v,
      maxPenetration: maxPen,
      overlapArea: maxArea,
    });
  }
  return { edge: [a, bb], candidates: cands };
}

// The gaps that admit no rhombus by pure geometry, given the current board.
function unfillableGaps(all: Tile[], poly: Pt[]): Gap[] {
  return holeFrontier(boardFrom(all), poly)
    .filter((e) => geomFills(all, e.a, e.bb).length === 0)
    .map((e) => enumGap(all, e.a, e.bb));
}

// "Fill the rest as far as the geometry allows." A bounded backtracking search for
// the LARGEST legal partial fill: drive the most-constrained frontier edge that
// still admits a tile, try each of its geometry-legal fills, and recurse, keeping
// the deepest fill found anywhere. Doomed (zero-fill) edges are simply left, so the
// search keeps filling around them; when no edge admits a tile the branch is stuck.
// Every placed tile is overlap-free against the whole board, so the result is a real
// partial fill, and what it cannot cover is the smallest gap the geometry forces, the
// triangle no rhombus fits. Deterministic (fixed frontier and candidate order); the
// finiteness bound guards the recursion.
function maximalGeomFill(fixed: Tile[], poly: Pt[]): Tile[] {
  const cap = Math.ceil(polyArea(poly) / SIN36) + 6;
  let best: Tile[] = [];
  const extra: Tile[] = [];

  function rec(): void {
    if (extra.length > best.length) best = [...extra];
    if (extra.length >= cap) return;
    const all = [...fixed, ...extra];
    const front = holeFrontier(boardFrom(all), poly);
    let edge: { a: Pt; bb: Pt } | null = null;
    let fills: Tile[] = [];
    for (const e of front) {
      const f = geomFills(all, e.a, e.bb);
      if (f.length === 0) continue; // doomed edge: leave it, fill around it
      if (edge === null || f.length < fills.length) {
        edge = e;
        fills = f;
      }
    }
    if (edge === null) return; // nothing fillable remains: this branch is stuck
    for (const cand of fills) {
      extra.push(cand);
      rec();
      extra.pop();
    }
  }
  rec();
  return best;
}

// ---------------------------------------------------------------------------
// Scene A: the rigid hexagon.
// ---------------------------------------------------------------------------

export type SceneA = {
  title: string;
  summary: string;
  holeCenter: Pt;
  holeArea: number;
  holePolygon: Pt[];
  wall: Tile[];
  // The unique geometry-only filling (two rhombi), in placement order.
  uniqueCompletion: Tile[];
  // The constrained frontier edge that admits two rhombi by pure geometry.
  constrainedEdge: [Pt, Pt];
  geomMovesOnEdge: number;
  // The tempting wrong move: it fits the constrained edge with zero overlap, then
  // strands. (The correct move is uniqueCompletion[0].)
  wrongMove: { type: "fat" | "thin"; corner: number | null; v: [Pt, Pt, Pt, Pt] };
  // The maximal legal partial fill placed after the wrong move before nothing fits.
  // What the hole keeps uncovered after the wrong move and this strand is the gap no
  // tile can fill (for the rigid hexagon this is empty: the wrong move alone strands).
  strandFill: Tile[];
  // Every gap left unfillable after the wrong move, with full overlap evidence.
  unfillableGaps: Gap[];
  // Always 0: after the wrong move the hole has no geometry-only completion.
  geomCompletionsAfterWrong: number;
};

function computeSceneA(): SceneA {
  const tiles = unitTiling(LEVELS);
  let center: Pt = SCENE_A_ANCHOR;
  let best = Infinity;
  for (const t of tiles) {
    const c = centroid(t);
    const d = Math.hypot(c[0] - SCENE_A_ANCHOR[0], c[1] - SCENE_A_ANCHOR[1]);
    if (d < best) {
      best = d;
      center = c;
    }
  }
  const { removed, kept } = carve(tiles, center, SCENE_A_RHOLE);
  const poly = holePolygon(kept, removed);
  if (!poly) throw new Error("geomWall sceneA: hole is not a single closed loop");

  const g = geomSearch(kept, poly, true);
  if (!g.firstCompletion) {
    throw new Error("geomWall sceneA: no geometry-only completion");
  }
  const right = g.firstCompletion;

  // The constrained frontier edge: fewest geometry-only moves.
  const front = holeFrontier(boardFrom(kept), poly);
  let edge = front[0];
  let moves = geomFills(kept, front[0].a, front[0].bb);
  for (let i = 1; i < front.length; i++) {
    const m = geomFills(kept, front[i].a, front[i].bb);
    if (m.length < moves.length) {
      edge = front[i];
      moves = m;
    }
  }
  // The wrong move: the geometry-only fill on that edge that strands (no
  // completion follows it). There is exactly one such move on a rigid hole.
  const wrong = moves.find(
    (m) => geomSearch([...kept, m], poly, false).completions === 0,
  );
  if (!wrong) throw new Error("geomWall sceneA: no stranding wrong move found");

  const after = [...kept, wrong];
  const afterSearch = geomSearch(after, poly, true);
  const gaps = unfillableGaps(after, poly);

  return {
    title: "Geometry-only dead-end: rigid hexagon hole",
    summary:
      "A six-edge hole with exactly one geometry-only filling, two rhombi. The constrained edge admits two rhombi by pure geometry; one completes, the other strands. After the wrong rhombus every candidate on the next gap overlaps committed tiles by real area.",
    holeCenter: center,
    holeArea: polyArea(poly),
    holePolygon: poly,
    wall: kept,
    uniqueCompletion: right,
    constrainedEdge: [edge.a, edge.bb],
    geomMovesOnEdge: moves.length,
    wrongMove: {
      type: wrong.type,
      corner: cornerAt(wrong, edgeKeyHead(edge.a, edge.bb)),
      v: wrong.v,
    },
    strandFill: maximalGeomFill(after, poly),
    unfillableGaps: gaps,
    geomCompletionsAfterWrong: afterSearch.completions,
  };
}

// ---------------------------------------------------------------------------
// Scene B: the expert's "a thin fits there" case, refuted.
// ---------------------------------------------------------------------------

export type SceneB = {
  title: string;
  summary: string;
  holeCenter: Pt;
  holeArea: number;
  holePolygon: Pt[];
  wall: Tile[];
  // The hole's one surviving completion (the only filling that finishes it). The
  // payoff: every wrong branch strands, this one does not.
  completion: Tile[];
  // The locally legal fill placed before the doomed edge is reached.
  forcedPrefix: Tile[];
  // The frontier edge the expert pointed at: a thin rhombus fits it with zero
  // overlap.
  doomedEdge: [Pt, Pt];
  // That tempting thin tile. It fits (penetration < TOUCH_EPS), the move the
  // objection is about. Place it anyway.
  temptingThin: { type: "fat" | "thin"; corner: number | null; v: [Pt, Pt, Pt, Pt] };
  // The maximal legal partial fill placed after the thin before nothing fits: "fill
  // the rest as far as you can." What stays uncovered after the prefix, the thin, and
  // this strand is the triangular gap no rhombus fits.
  strandFill: Tile[];
  // Every gap left unfillable after placing the thin, with full overlap evidence.
  unfillableGaps: Gap[];
  // Always 0: after the thin the hole has no geometry-only completion.
  geomCompletionsAfterThin: number;
};

function computeSceneB(): SceneB {
  // Reuse the section-5 hole exactly: same anchor, same RHOLE, same wall and hole
  // loop, same matching-rule dead-ends. We take its depth-7 dead-end (a locally
  // legal fill that the rule says dooms an edge) and prove the doom is GEOMETRIC.
  const scene = computeScene();
  const d = scene.deadEnds.find((x) => x.depth === 7);
  if (!d) throw new Error("geomWall sceneB: depth-7 dead-end not found");

  const poly = scene.hole;
  const base = [...scene.wall, ...d.fill];
  const [a, bb] = d.doomedEdge;

  // On the doomed edge a thin rhombus fits with zero overlap: the expert's move.
  const fits = geomFills(base, a, bb);
  if (fits.length === 0) {
    throw new Error("geomWall sceneB: doomed edge admits no geometry fill");
  }
  const thin = fits[0];
  if (thin.type !== "thin") {
    throw new Error(`geomWall sceneB: tempting fill is ${thin.type}, not thin`);
  }

  const after = [...base, thin];
  const afterSearch = geomSearch(after, poly, true);
  const completions = afterSearch.completions;
  const gaps = unfillableGaps(after, poly);

  return {
    title: "Geometry-only dead-end: the 'a thin fits there' case, refuted",
    summary:
      "On this doomed edge a thin rhombus does fit with zero overlap, the expert's objection. Place it. The geometry-only exhaustive search then finds no completion: the very next gap admits no rhombus without real overlap.",
    holeCenter: scene.meta.holeCenter,
    holeArea: polyArea(poly),
    holePolygon: poly,
    wall: scene.wall,
    completion: scene.completion,
    forcedPrefix: d.fill,
    doomedEdge: [a, bb],
    temptingThin: {
      type: thin.type,
      corner: cornerAt(thin, edgeKeyHead(a, bb)),
      v: thin.v,
    },
    strandFill: maximalGeomFill(after, poly),
    unfillableGaps: gaps,
    geomCompletionsAfterThin: completions,
  };
}

// ---------------------------------------------------------------------------
// The one public entry point: compute both scenes deterministically.
// ---------------------------------------------------------------------------

export type GeomWalls = {
  sceneA_rigidHexagon: SceneA;
  sceneB_thinRefuted: SceneB;
};

export function computeGeomWalls(): GeomWalls {
  return {
    sceneA_rigidHexagon: computeSceneA(),
    sceneB_thinRefuted: computeSceneB(),
  };
}
