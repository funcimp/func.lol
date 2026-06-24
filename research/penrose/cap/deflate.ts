// Deflation (the Penrose substitution) on Robinson triangles. Two triangles glue
// into a P3 rhombus; subdividing every triangle by the golden ratio refines the
// tiling one level. The unique supertile grouping makes this deterministic and
// exactly invertible (composition = inflation), so deflation is reliable at any
// depth. Preshing's formulation.

export const PHI = (1 + Math.sqrt(5)) / 2;

export type Pt = readonly [number, number];
// color 0 = acute (golden) triangle, color 1 = obtuse (gnomon). Apex is `a`,
// the two equal legs are a-b and a-c.
export type Tri = { color: 0 | 1; a: Pt; b: Pt; c: Pt };

const lerpPhi = (p: Pt, q: Pt): Pt => [p[0] + (q[0] - p[0]) / PHI, p[1] + (q[1] - p[1]) / PHI];
const dist = (p: Pt, q: Pt): number => Math.hypot(p[0] - q[0], p[1] - q[1]);

export function subdivide(tris: readonly Tri[]): Tri[] {
  const out: Tri[] = [];
  for (const { color, a, b, c } of tris) {
    if (color === 0) {
      const p = lerpPhi(a, b);
      out.push({ color: 0, a: c, b: p, c: b }, { color: 1, a: p, b: c, c: a });
    } else {
      const q = lerpPhi(b, a);
      const r = lerpPhi(b, c);
      out.push({ color: 1, a: r, b: c, c: a }, { color: 1, a: q, b: r, c: b }, { color: 0, a: r, b: q, c: a });
    }
  }
  return out;
}

// Wheel of 10 acute triangles around the origin (legs of length `radius`).
export function wheel(radius = 1): Tri[] {
  const t: Tri[] = [];
  for (let i = 0; i < 10; i++) {
    let b: Pt = [radius * Math.cos(((2 * i - 1) * Math.PI) / 10), radius * Math.sin(((2 * i - 1) * Math.PI) / 10)];
    let c: Pt = [radius * Math.cos(((2 * i + 1) * Math.PI) / 10), radius * Math.sin(((2 * i + 1) * Math.PI) / 10)];
    if (i % 2 === 0) [b, c] = [c, b];
    t.push({ color: 0, a: [0, 0], b, c });
  }
  return t;
}

// Deflate `levels` times from a starting wheel.
export function deflate(levels: number, radius = 1): Tri[] {
  let t: Tri[] = wheel(radius);
  for (let n = 0; n < levels; n++) t = subdivide(t);
  return t;
}

export function colorCounts(tris: readonly Tri[]): { c0: number; c1: number } {
  let c0 = 0, c1 = 0;
  for (const t of tris) (t.color === 0 ? c0++ : c1++);
  return { c0, c1 };
}

// The leg length (a-b); for a Robinson triangle the two legs are equal.
export const legLength = (t: Tri): number => dist(t.a, t.b);
export const otherLeg = (t: Tri): number => dist(t.a, t.c);

// Two triangles sharing their long edge form a rhombus; thick:thin follows the
// color ratio, so we count colors (a reliable invariant, unlike face extraction
// from a bare vertex set).
