// Authored geometry for the "deeper problem" sketch (spine section 5). It builds a
// genuine Penrose rhombus patch grown outward from a seed, orders the rhombi by
// distance so the construction animates ring by ring, and picks ONE rhombus in an
// outer ring to stand in for the forced, unfillable gap.
//
// Why a real patch under a hand-authored mark: the teaching beat is that local
// correctness does not guarantee a global tiling, and the contradiction can be
// forced arbitrarily far from any choice you made. So the patch the viewer watches
// grow must look flawless everywhere (it is a real Penrose patch, built by the
// substitution rule), while the failure is a crafted overlay on one far tile, not
// an engine output. The global engine never dead-ends; only a local hand does, and
// this is an honest staging of that, not a solver.
//
// The substitution here is a small self-contained copy of the Robinson-triangle
// rule (a little copying over a dependency on the explorer engine, which this
// sketch must not touch). Two triangles sharing their long edge form one P3
// rhombus, exactly as the explorer's faces module pairs them.

export const PHI = (1 + Math.sqrt(5)) / 2;

export type Pt = readonly [number, number];

// color 0 = acute (golden) triangle -> thick rhombus; color 1 = obtuse (gnomon)
// -> thin rhombus. Apex is `a`, the two equal legs are a-b and a-c.
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

// Wheel of 10 acute triangles around the origin: the decagonal seed every Penrose
// "sun" patch grows from. Legs of length `radius`.
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

function deflate(levels: number, radius: number): Tri[] {
  let t = wheel(radius);
  for (let n = 0; n < levels; n++) t = subdivide(t);
  return t;
}

// One placed rhombus: its four corners (counter-clockwise), its kind, the distance
// of its centroid from the patch center (drives the grow order), and a stable key.
export type PatchRhombus = {
  kind: "thick" | "thin";
  corners: readonly [Pt, Pt, Pt, Pt];
  center: Pt;
  radius: number; // |centroid|, the grow-out distance
};

const centroid = (pts: readonly Pt[]): Pt => {
  let x = 0;
  let y = 0;
  for (const [px, py] of pts) {
    x += px;
    y += py;
  }
  return [x / pts.length, y / pts.length];
};

// Pair the substitution triangles by their shared long edge into P3 rhombi, exactly
// as a Penrose rhombus tiling decomposes into Robinson triangles. A pair that does
// not close (a triangle on the patch boundary with no partner) is dropped: those
// are the ragged edge of the finite patch, not tiles.
export function patchRhombi(levels: number, radius: number): PatchRhombus[] {
  const tris = deflate(levels, radius);
  const key = (p: Pt) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
  const byBase = new Map<
    string,
    { apexes: Pt[]; base: [Pt, Pt]; color: 0 | 1 }
  >();
  for (const t of tris) {
    const k = [key(t.b), key(t.c)].sort().join("|");
    const e =
      byBase.get(k) ??
      byBase.set(k, { apexes: [], base: [t.b, t.c], color: t.color }).get(k)!;
    e.apexes.push(t.a);
  }
  const out: PatchRhombus[] = [];
  for (const { apexes, base, color } of byBase.values()) {
    if (apexes.length !== 2) continue;
    const corners: readonly [Pt, Pt, Pt, Pt] = [
      apexes[0],
      base[0],
      apexes[1],
      base[1],
    ];
    const c = centroid(corners);
    out.push({
      kind: color === 0 ? "thick" : "thin",
      corners,
      center: c,
      radius: Math.hypot(c[0], c[1]),
    });
  }
  // Grow from the seed outward: nearest centroid first.
  out.sort((p, q) => p.radius - q.radius);
  return out;
}

// The forced gap: one rhombus in an outer ring, far from the seed, that the sketch
// strikes out to stand for the unfillable slot. We pick the rhombus whose centroid
// is closest to a chosen bearing at a large fraction of the patch radius, so the
// mark lands distinctly out near the rim, not at the center where construction
// began. The distance between the seed and this tile is the whole point.
export function forcedGapIndex(
  rhombi: readonly PatchRhombus[],
  bearing: number,
): number {
  if (rhombi.length === 0) return -1;
  const maxR = rhombi.reduce((m, r) => Math.max(m, r.radius), 0);
  const targetR = maxR * 0.82; // out near the rim, but inside the ragged boundary
  const tx = Math.cos(bearing);
  const ty = Math.sin(bearing);
  let best = -1;
  let bestScore = Infinity;
  rhombi.forEach((r, i) => {
    // Penalise distance from the target ring and angular distance from the bearing.
    const dr = Math.abs(r.radius - targetR);
    const dirx = r.center[0] / (r.radius || 1);
    const diry = r.center[1] / (r.radius || 1);
    const dot = dirx * tx + diry * ty; // 1 when aligned with the bearing
    const score = dr - r.radius * 0.05 * dot;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}
