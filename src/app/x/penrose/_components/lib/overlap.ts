// The real-overlap engine: convex polygon intersection by separating-axis
// penetration and Sutherland-Hodgman clipping. Dependency-free on purpose, so the
// geometry-only sketches (which run in the browser) and the geometry-only proof
// (which runs in bun:test) share ONE auditable overlap test without dragging the
// heavy deflation/search code into the client bundle.
//
// This is the whole answer to the Penrose expert's objection. The earlier sketches
// rejected a tempting move by the matching rule; a viewer can dispute a rule. Here
// the wall is measured: a candidate is rejected only when it shares real interior
// area with a committed tile. Edge-touching (the legitimate way two rhombi meet)
// is NOT overlap. Above the touch epsilon, one shape is genuinely on top of
// another, and we can shade the exact region where.

export type Pt = readonly [number, number];

// Overlap depth below this on every axis counts as merely touching, the legitimate
// way two rhombi meet. Above it, real interior area is shared.
export const TOUCH_EPS = 1e-6;

// Signed overlap depth. Positive means the two convex polygons truly overlap by
// that much along the tightest separating direction; non-positive means a
// separating axis exists (disjoint, or merely touching). Returns the minimum
// positive penetration over all axes, or the non-positive value on separation.
export function penetration(a: readonly Pt[], b: readonly Pt[]): number {
  const axes: Pt[] = [];
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const e: Pt = [
        poly[(i + 1) % poly.length][0] - poly[i][0],
        poly[(i + 1) % poly.length][1] - poly[i][1],
      ];
      const n: Pt = [-e[1], e[0]];
      const len = Math.hypot(n[0], n[1]) || 1;
      axes.push([n[0] / len, n[1] / len]);
    }
  }
  let minPen = Infinity;
  for (const ax of axes) {
    let aLo = Infinity;
    let aHi = -Infinity;
    let bLo = Infinity;
    let bHi = -Infinity;
    for (const p of a) {
      const d = p[0] * ax[0] + p[1] * ax[1];
      if (d < aLo) aLo = d;
      if (d > aHi) aHi = d;
    }
    for (const p of b) {
      const d = p[0] * ax[0] + p[1] * ax[1];
      if (d < bLo) bLo = d;
      if (d > bHi) bHi = d;
    }
    const overlap = Math.min(aHi, bHi) - Math.max(aLo, bLo);
    if (overlap <= 0) return overlap; // separating axis found: no overlap
    if (overlap < minPen) minPen = overlap;
  }
  return minPen;
}

// True iff the polygons share real interior area (more than just an edge touch).
export function overlapsReal(a: readonly Pt[], b: readonly Pt[]): boolean {
  return penetration(a, b) > TOUCH_EPS;
}

// Sutherland-Hodgman clip of subject by a convex clipper, returning the clipped
// polygon (the shared interior, empty when disjoint).
export function overlapPolygon(subject: Pt[], clipper: Pt[]): Pt[] {
  let out = subject.slice();
  const cl = signedArea(clipper) < 0 ? clipper.slice().reverse() : clipper.slice();
  for (let i = 0; i < cl.length; i++) {
    const a = cl[i];
    const b = cl[(i + 1) % cl.length];
    const inside = (p: Pt) =>
      (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
    const inter = (p: Pt, q: Pt): Pt => {
      const a1 = b[1] - a[1];
      const b1 = a[0] - b[0];
      const c1 = a1 * a[0] + b1 * a[1];
      const a2 = q[1] - p[1];
      const b2 = p[0] - q[0];
      const c2 = a2 * p[0] + b2 * p[1];
      const det = a1 * b2 - a2 * b1;
      if (Math.abs(det) < 1e-15) return q;
      return [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
    };
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prv = input[(j + input.length - 1) % input.length];
      const curIn = inside(cur);
      const prvIn = inside(prv);
      if (curIn) {
        if (!prvIn) out.push(inter(prv, cur));
        out.push(cur);
      } else if (prvIn) {
        out.push(inter(prv, cur));
      }
    }
    if (out.length === 0) return [];
  }
  return out.length < 3 ? [] : out;
}

// The real shared area of two convex polygons. Zero when they do not overlap.
export function overlapArea(a: Pt[], b: Pt[]): number {
  const c = overlapPolygon(a, b);
  return c.length < 3 ? 0 : Math.abs(signedArea(c));
}

function signedArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return s / 2;
}
