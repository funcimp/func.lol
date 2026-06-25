// A naive greedy Penrose P3 solver and its legality oracle, ported verbatim in
// behaviour from a verified spike. This module is the honest source for the
// "stop tiling by hand" sketch: it COMPUTES the dead-end rather than authoring
// it. Nothing here is staged. The solver lays unit rhombi one at a time, obeying
// only the local matching rule, and strands itself. The sketch draws what the
// solver did.
//
// THE MATCHING RULE (vertex-star formulation, equivalent to Penrose's arrow
// decorations). In a legal P3 tiling the cyclic sequence of rhombus CORNER
// ANGLES around every interior vertex is one of exactly seven "vertex stars".
// Each corner is 36, 72, 108, or 144 degrees and the corners around a closed
// vertex sum to 360. The seven stars below were DERIVED from a real deflated
// tiling (every fully surrounded vertex of a five-times-deflated decagon) and
// cross-checked against the literature: there are seven, no more. A partial fan
// around a not-yet-closed vertex is legal iff its contiguous arc of placed
// corners occurs inside one of the seven stars; a closed vertex must equal a
// full star. naiveSolver.test.ts re-runs that derivation as an oracle: it
// accepts a real deflated patch with ZERO violations. That test is what keeps
// this module honest.
//
// THE DEAD-END the solver reaches. Seeded with one fat rhombus, growing toward
// whichever open edge is closest to closing a vertex, it strands after ten tiles
// about two edge-lengths from the seed. At the stranded vertex three fat corners
// are committed: [108, 108, 108], summing to 324, leaving a 36-degree wedge. A
// thin acute corner is exactly 36 degrees, so it FITS the gap geometrically. But
// it would close the vertex to [108, 108, 108, 36], which is not one of the
// seven stars, so the matching rule forbids it. Every other candidate overlaps a
// placed tile. A tile fits the gap and is still illegal: the rules leave no legal
// move. The claim is never "no tile fits".

export const PHI = (1 + Math.sqrt(5)) / 2;

export type Pt = readonly [number, number];

// ---------------------------------------------------------------------------
// The seven admissible vertex stars (cyclic sequences of corner angles).
// ---------------------------------------------------------------------------

export const STARS: readonly (readonly number[])[] = [
  [72, 72, 72, 72, 72], // Sun
  [36, 36, 72, 36, 36, 72, 72], // Star
  [144, 144, 72], // Deuce
  [144, 72, 72, 72], // Jack
  [108, 108, 144], // (fat, fat, thin)
  [108, 108, 36, 72, 36], // mixed
  [36, 36, 72, 72, 72, 72], // mixed
];

// Every contiguous arc (in both cyclic directions) of every star, stored as a
// joined string for O(1) lookup. A partial fan is a legal arc iff it appears
// here. Built once at module load.
function buildArcSet(stars: readonly (readonly number[])[]): Set<string> {
  const set = new Set<string>();
  for (const star of stars) {
    const n = star.length;
    for (const seq of [star, [...star].reverse()]) {
      for (let start = 0; start < n; start++) {
        const arc: number[] = [];
        for (let len = 1; len <= n; len++) {
          arc.push(seq[(start + len - 1) % n]);
          set.add(arc.join(","));
        }
      }
    }
  }
  return set;
}
const ARCS = buildArcSet(STARS);

// A contiguous fan of placed corner angles (in angular order) is legal iff it is
// an arc of some star and does not already exceed 360. Completeness is checked
// separately by isCompleteStar.
export function arcLegal(orderedAngles: readonly number[]): boolean {
  if (orderedAngles.length === 0) return true;
  if (orderedAngles.reduce((s, a) => s + a, 0) > 360 + 1e-6) return false;
  return ARCS.has(orderedAngles.join(","));
}

// A closed vertex (corners sum to 360) is legal iff its cyclic arrangement is one
// of the seven stars.
export function isCompleteStar(orderedAngles: readonly number[]): boolean {
  const sum = orderedAngles.reduce((s, a) => s + a, 0);
  if (Math.abs(sum - 360) > 1e-6) return false;
  return STARS.some((star) => cyclicEqual(orderedAngles, star));
}

function cyclicEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const n = a.length;
  for (const cand of [b, [...b].reverse()]) {
    for (let r = 0; r < n; r++) {
      let ok = true;
      for (let i = 0; i < n; i++) {
        if (a[i] !== cand[(r + i) % n]) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Deflation and rhombus pairing, copied small so the oracle test can run against
// a real tiling without importing the explorer engine (a little copying is
// better than a little dependency). Robinson triangles: color 0 = acute (half a
// FAT rhombus), color 1 = obtuse (half a THIN rhombus). Two same-colour
// triangles sharing their base edge glue into one rhombus.
// ---------------------------------------------------------------------------

type Tri = { color: 0 | 1; a: Pt; b: Pt; c: Pt };
const lerpPhi = (p: Pt, q: Pt): Pt => [
  p[0] + (q[0] - p[0]) / PHI,
  p[1] + (q[1] - p[1]) / PHI,
];

function subdivide(tris: readonly Tri[]): Tri[] {
  const out: Tri[] = [];
  for (const { color, a, b, c } of tris) {
    if (color === 0) {
      const p = lerpPhi(a, b);
      out.push({ color: 0, a: c, b: p, c: b }, { color: 1, a: p, b: c, c: a });
    } else {
      const q = lerpPhi(b, a);
      const r = lerpPhi(b, c);
      out.push(
        { color: 1, a: r, b: c, c: a },
        { color: 1, a: q, b: r, c: b },
        { color: 0, a: r, b: q, c: a },
      );
    }
  }
  return out;
}

function wheel(radius: number): Tri[] {
  const t: Tri[] = [];
  for (let i = 0; i < 10; i++) {
    let b: Pt = [
      radius * Math.cos(((2 * i - 1) * Math.PI) / 10),
      radius * Math.sin(((2 * i - 1) * Math.PI) / 10),
    ];
    let c: Pt = [
      radius * Math.cos(((2 * i + 1) * Math.PI) / 10),
      radius * Math.sin(((2 * i + 1) * Math.PI) / 10),
    ];
    if (i % 2 === 0) [b, c] = [c, b];
    t.push({ color: 0, a: [0, 0], b, c });
  }
  return t;
}

// A deflated patch as paired rhombi: a genuine Penrose P3 tiling, used only to
// feed the legality oracle in the test.
export function deflatedRhombi(
  levels: number,
  radius = 1,
): { type: "fat" | "thin"; v: [Pt, Pt, Pt, Pt] }[] {
  let t = wheel(radius);
  for (let n = 0; n < levels; n++) t = subdivide(t);
  return pairRhombi(t);
}

function pairRhombi(
  tris: readonly Tri[],
): { type: "fat" | "thin"; v: [Pt, Pt, Pt, Pt] }[] {
  const byBase = new Map<string, number[]>();
  tris.forEach((tri, ti) => {
    const k = edgeKey(tri.b, tri.c);
    const arr = byBase.get(k) ?? [];
    arr.push(ti);
    byBase.set(k, arr);
  });
  const used = new Set<number>();
  const out: { type: "fat" | "thin"; v: [Pt, Pt, Pt, Pt] }[] = [];
  for (const [, refs] of byBase) {
    if (refs.length !== 2) continue;
    const [i1, i2] = refs;
    if (used.has(i1) || used.has(i2)) continue;
    const t1 = tris[i1];
    const t2 = tris[i2];
    if (t1.color !== t2.color) continue;
    const v = ccw4([t1.a, t1.b, t2.a, t1.c]);
    out.push({ type: t1.color === 1 ? "fat" : "thin", v });
    used.add(i1);
    used.add(i2);
  }
  return out;
}

function ccw4(pts: [Pt, Pt, Pt, Pt]): [Pt, Pt, Pt, Pt] {
  const cx = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
  const cy = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
  return [...pts].sort(
    (a, b) =>
      Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx),
  ) as [Pt, Pt, Pt, Pt];
}

// ---------------------------------------------------------------------------
// Geometry helpers shared by the board.
// ---------------------------------------------------------------------------

const EPS = 1e-7;
function keyPt(p: Pt): string {
  return `${Math.round(p[0] / EPS)},${Math.round(p[1] / EPS)}`;
}
function edgeKey(p: Pt, q: Pt): string {
  const kp = keyPt(p);
  const kq = keyPt(q);
  return kp < kq ? `${kp}|${kq}` : `${kq}|${kp}`;
}
function sub(a: Pt, b: Pt): Pt {
  return [a[0] - b[0], a[1] - b[1]];
}
function add(a: Pt, b: Pt): Pt {
  return [a[0] + b[0], a[1] + b[1]];
}
function interiorAngle(prev: Pt, cur: Pt, next: Pt): number {
  const u = sub(prev, cur);
  const w = sub(next, cur);
  const c = (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}
function snapAngle(deg: number): 36 | 72 | 108 | 144 {
  return [36, 72, 108, 144].reduce(
    (b, a) => (Math.abs(a - deg) < Math.abs(b - deg) ? a : b),
    36,
  ) as 36 | 72 | 108 | 144;
}
const norm = (x: number) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

// ---------------------------------------------------------------------------
// A placed rhombus.
// ---------------------------------------------------------------------------

export type Tile = { type: "fat" | "thin"; v: [Pt, Pt, Pt, Pt] };

const ACUTE = { fat: 72, thin: 36 } as const;

// Seat a unit rhombus of `type` on the directed edge p->q so its body falls to
// the left (counter-clockwise), with interior angle `cornerAtP` at p. Combined
// with both edge directions and both corner choices this gives all eight ways a
// rhombus can share one physical edge.
function attach(
  type: "fat" | "thin",
  p: Pt,
  q: Pt,
  cornerAtP: number,
): Tile {
  void ACUTE; // both types share the same corner pair {acute, obtuse}
  const aP = cornerAtP;
  const aQ = 180 - aP;
  const base = Math.atan2(q[1] - p[1], q[0] - p[0]);
  const dirP = base + (aP * Math.PI) / 180;
  const v3: Pt = add(p, [Math.cos(dirP), Math.sin(dirP)]);
  const dirQ = base + Math.PI - (aQ * Math.PI) / 180;
  const v2: Pt = add(q, [Math.cos(dirQ), Math.sin(dirQ)]);
  return { type, v: [p, q, v2, v3] };
}

// Separating-axis overlap test, touching allowed. True iff the polygons share
// interior area.
function overlap(A: readonly Pt[], B: readonly Pt[]): boolean {
  const norms = (P: readonly Pt[]) =>
    P.map((_, i) => {
      const e = sub(P[(i + 1) % P.length], P[i]);
      return [-e[1], e[0]] as Pt;
    });
  const proj = (P: readonly Pt[], ax: Pt): [number, number] => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of P) {
      const d = p[0] * ax[0] + p[1] * ax[1];
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    return [lo, hi];
  };
  for (const ax of [...norms(A), ...norms(B)]) {
    const [a0, a1] = proj(A, ax);
    const [b0, b1] = proj(B, ax);
    if (a1 - b0 < 1e-6 || b1 - a0 < 1e-6) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// The board: placed tiles, edge ownership, per-vertex angular fans.
// ---------------------------------------------------------------------------

type Corner = { angle: number; ccwStart: number };

class Board {
  readonly tiles: Tile[] = [];
  private edgeOwners = new Map<string, number>();
  private vfan = new Map<string, Corner[]>();

  place(t: Tile): void {
    this.tiles.push(t);
    for (let i = 0; i < 4; i++) {
      const k = edgeKey(t.v[i], t.v[(i + 1) % 4]);
      this.edgeOwners.set(k, (this.edgeOwners.get(k) ?? 0) + 1);
    }
    for (const c of cornersOf(t)) {
      const arr = this.vfan.get(c.key) ?? [];
      arr.push({ angle: c.angle, ccwStart: c.ccwStart });
      this.vfan.set(c.key, arr);
    }
  }

  // Open edges (owned by exactly one tile) in a deterministic order.
  openEdges(): { key: string; a: Pt; b: Pt }[] {
    const out: { key: string; a: Pt; b: Pt }[] = [];
    const seen = new Set<string>();
    for (const t of this.tiles) {
      for (let i = 0; i < 4; i++) {
        const a = t.v[i];
        const b = t.v[(i + 1) % 4];
        const k = edgeKey(a, b);
        if (this.edgeOwners.get(k) === 1 && !seen.has(k)) {
          seen.add(k);
          out.push({ key: k, a, b });
        }
      }
    }
    out.sort((x, y) => (x.key < y.key ? -1 : 1));
    return out;
  }

  overlapsAny(t: Tile): boolean {
    return this.tiles.some((u) => overlap(t.v, u.v));
  }

  // Would placing t keep every vertex it touches legal? Returns the first
  // offending reason so the dead-end can be explained.
  legalAfter(t: Tile): { ok: boolean; reason?: string } {
    for (const c of cornersOf(t)) {
      const existing = this.vfan.get(c.key) ?? [];
      const merged = [
        ...existing,
        { angle: c.angle, ccwStart: c.ccwStart },
      ].sort((p, q) => p.ccwStart - q.ccwStart);
      const sum = merged.reduce((s, m) => s + m.angle, 0);
      if (sum > 360 + 1e-6) {
        return { ok: false, reason: `vertex angle sum ${sum} > 360` };
      }
      const angles = merged.map((m) => m.angle);
      const contiguous = isContig(merged);
      if (Math.abs(sum - 360) < 1e-6) {
        if (!contiguous || !isCompleteStar(angles)) {
          return { ok: false, reason: `closes to non-star [${angles}]` };
        }
      } else if (contiguous) {
        if (!arcLegal(angles)) {
          return { ok: false, reason: `fan [${angles}] is not a legal arc` };
        }
      } else if (!runsLegal(merged)) {
        return { ok: false, reason: `runs not all legal arcs` };
      }
    }
    return { ok: true };
  }

  vertexFanAt(key: string): Corner[] {
    return this.vfan.get(key) ?? [];
  }
}

function cornersOf(t: Tile): { key: string; angle: number; ccwStart: number }[] {
  const out: { key: string; angle: number; ccwStart: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const cur = t.v[i];
    const prev = t.v[(i + 3) % 4];
    const next = t.v[(i + 1) % 4];
    const angle = snapAngle(interiorAngle(prev, cur, next));
    const aPrev = Math.atan2(prev[1] - cur[1], prev[0] - cur[0]);
    const aNext = Math.atan2(next[1] - cur[1], next[0] - cur[0]);
    const rad = (angle * Math.PI) / 180;
    const ccwStart = norm(
      norm(aPrev + rad - aNext) < 1e-6 ? aPrev : aNext,
    );
    out.push({ key: keyPt(cur), angle, ccwStart });
  }
  return out;
}

function isContig(merged: Corner[]): boolean {
  for (let i = 0; i < merged.length - 1; i++) {
    const end = merged[i].ccwStart + (merged[i].angle * Math.PI) / 180;
    if (
      Math.abs(
        ((end - merged[i + 1].ccwStart + Math.PI) % (2 * Math.PI)) - Math.PI,
      ) > 1e-4
    ) {
      return false;
    }
  }
  return true;
}

function runsLegal(merged: Corner[]): boolean {
  let run: number[] = [merged[0].angle];
  for (let i = 0; i < merged.length - 1; i++) {
    const end = merged[i].ccwStart + (merged[i].angle * Math.PI) / 180;
    const adj =
      Math.abs(
        ((end - merged[i + 1].ccwStart + Math.PI) % (2 * Math.PI)) - Math.PI,
      ) <= 1e-4;
    if (adj) {
      run.push(merged[i + 1].angle);
    } else {
      if (!arcLegal(run)) return false;
      run = [merged[i + 1].angle];
    }
  }
  return arcLegal(run);
}

// All eight rhombus placements that share the physical edge (a, b), in a fixed
// deterministic try-order.
export function candidates(a: Pt, b: Pt): Tile[] {
  const out: Tile[] = [];
  const dirs: [Pt, Pt][] = [
    [a, b],
    [b, a],
  ];
  const order: ["fat" | "thin", number][] = [
    ["fat", 72],
    ["fat", 108],
    ["thin", 36],
    ["thin", 144],
  ];
  for (const [p, q] of dirs) {
    for (const [type, corner] of order) out.push(attach(type, p, q, corner));
  }
  return out;
}

// ---------------------------------------------------------------------------
// The greedy solver and its honest result.
// ---------------------------------------------------------------------------

// One placed step plus the running tile count, so the sketch can reveal the
// build one tile at a time.
export type Step = { index: number; tile: Tile };

// The verified dead-end: the stranded vertex, the corners already committed
// there, the wedge still open, the thin tile that fits that wedge but is illegal,
// and the human-readable reason.
export type DeadEnd = {
  vertex: Pt;
  committedAngles: number[]; // e.g. [108, 108, 108]
  gapAngle: number; // e.g. 36
  ghost: Tile; // the only non-overlapping candidate, an illegal thin fill
  closesTo: number[]; // the forbidden star it would form, e.g. [108,108,108,36]
  reason: string;
};

export type Solution = {
  steps: Step[];
  deadEnd: DeadEnd;
};

function fatSeed(): Tile {
  const A = (72 * Math.PI) / 180;
  return {
    type: "fat",
    v: [
      [0, 0],
      [1, 0],
      [1 + Math.cos(A), Math.sin(A)],
      [Math.cos(A), Math.sin(A)],
    ],
  };
}

function vertexSum(board: Board, key: string): number {
  return board.vertexFanAt(key).reduce((s, c) => s + c.angle, 0);
}

// Grow greedily toward closing vertices: at each step take the open edge whose
// endpoints are closest to a closed 360, place the first legal non-overlapping
// candidate, then look for a vertex whose remaining wedge no candidate can
// legally fill. That stranded vertex is the dead-end. Deterministic: a fat seed,
// a fixed edge order, a fixed candidate order.
export function solveToDeadEnd(): Solution {
  const board = new Board();
  const seed = fatSeed();
  board.place(seed);
  const steps: Step[] = [{ index: 0, tile: seed }];

  for (let step = 0; step < 5000; step++) {
    const open = board.openEdges();
    if (open.length === 0) break;
    const scored = open.map((e) => ({
      e,
      score: Math.max(
        vertexSum(board, keyPt(e.a)),
        vertexSum(board, keyPt(e.b)),
      ),
    }));
    scored.sort((x, y) => y.score - x.score || (x.e.key < y.e.key ? -1 : 1));

    let placed = false;
    for (const { e } of scored) {
      for (const c of candidates(e.a, e.b)) {
        if (board.overlapsAny(c)) continue;
        if (!board.legalAfter(c).ok) continue;
        board.place(c);
        steps.push({ index: steps.length, tile: c });
        placed = true;
        break;
      }
      if (placed) break;
    }
    if (!placed) break;

    const dead = findStranded(board);
    if (dead) return { steps, deadEnd: dead };
  }

  throw new Error("solver did not strand: the dead-end is not reproducible");
}

// A vertex is stranded if it is open, has at least one exposed edge, and no
// candidate on any exposed edge is both non-overlapping and legal. We then
// compute the wedge, the only non-overlapping candidate (the tempting illegal
// fill), and the forbidden star it would form.
function findStranded(board: Board): DeadEnd | null {
  const verts = new Set<string>();
  for (const t of board.tiles) for (const p of t.v) verts.add(keyPt(p));

  for (const key of verts) {
    const sum = vertexSum(board, key);
    if (sum >= 360 - 1e-6) continue;
    const open = board
      .openEdges()
      .filter((e) => keyPt(e.a) === key || keyPt(e.b) === key);
    if (open.length === 0) continue;

    let fillable = false;
    let ghost: Tile | null = null;
    for (const e of open) {
      for (const c of candidates(e.a, e.b)) {
        if (board.overlapsAny(c)) continue;
        if (board.legalAfter(c).ok) {
          fillable = true;
          break;
        }
        // Non-overlapping but illegal: this is the tempting fill.
        if (!ghost) ghost = c;
      }
      if (fillable) break;
    }
    if (fillable || !ghost) continue;

    const committedAngles = board
      .vertexFanAt(key)
      .slice()
      .sort((a, b) => a.ccwStart - b.ccwStart)
      .map((c) => c.angle);
    const gapAngle = 360 - sum;
    const closesTo = [...committedAngles, gapAngle];
    const vertex = key.split(",").map((n) => Number(n) * EPS) as [
      number,
      number,
    ];
    const reason = board.legalAfter(ghost).reason ?? "illegal";
    return { vertex, committedAngles, gapAngle, ghost, closesTo, reason };
  }
  return null;
}
