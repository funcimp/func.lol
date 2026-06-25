// Data for the two scaling sketches (spine section 9, "More magic: scaling").
//
// Both sketches stand on the real substitution engine (deflate, in
// explore/lib/deflate.ts), so the counts are genuine and the supertiles are not
// hand-drawn. A Penrose rhombus is two Robinson triangles glued on their shared
// base edge: two acute (color 0) triangles make a THIN rhombus, two obtuse
// (color 1) triangles make a THICK one. Pairing the deflation output on the base
// edge recovers every complete rhombus AND its kind, and those counts match
// faces.ts substitutionFaces tile for tile (see scaling.test.ts).
//
//   GOLDEN RATIO   At each level draw the patch and count thick:thin. The ratio
//                  homes in on phi as the level climbs, the same phi that set the
//                  tile angles. The object counted is the rhombus, the thing on
//                  screen.
//
//   HIERARCHY      deflate(L) is subdivide(deflate(L-1)), so the level-(L-1)
//                  rhombi ARE the supertiles the level-L rhombi compose into.
//                  Draw the small tiles filled and the genuine level-up tiles as
//                  ink outlines at the same physical scale: self-similarity, the
//                  engine's own output at two depths.

import { deflate, type Pt, type Tri } from "../../explore/lib/deflate";

export type { Pt } from "../../explore/lib/deflate";
export { PHI } from "../../explore/lib/deflate";

export type RhombusKind = "thick" | "thin";

// A complete rhombus recovered from the deflation: its kind and its four corners
// in draw order (apex, base, apex, base), a simple convex quad.
export type Rhombus = { kind: RhombusKind; corners: [Pt, Pt, Pt, Pt] };

const pkey = (p: Pt) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;

// Pair triangles on their shared base edge into complete rhombi. Half-rhombi at
// the patch boundary have only one triangle on their base and are dropped: a
// rhombus needs both halves, exactly as faces.ts requires both apexes. The kind
// follows the paired color: two obtuse (1) -> thick, two acute (0) -> thin.
export function rhombiFromTris(tris: readonly Tri[]): Rhombus[] {
  const byBase = new Map<string, { apexes: Pt[]; base: [Pt, Pt]; colors: (0 | 1)[] }>();
  for (const t of tris) {
    const k = [pkey(t.b), pkey(t.c)].sort().join("|");
    const e = byBase.get(k) ?? byBase.set(k, { apexes: [], base: [t.b, t.c], colors: [] }).get(k)!;
    e.apexes.push(t.a);
    e.colors.push(t.color);
  }
  const out: Rhombus[] = [];
  for (const { apexes, base, colors } of byBase.values()) {
    if (apexes.length !== 2) continue;
    const kind: RhombusKind = colors[0] === 1 && colors[1] === 1 ? "thick" : "thin";
    out.push({ kind, corners: [apexes[0], base[0], apexes[1], base[1]] });
  }
  return out;
}

// The complete rhombi of the wheel deflated `level` times, at unit wheel radius.
export function rhombiAt(level: number): Rhombus[] {
  return rhombiFromTris(deflate(level, 1));
}

// Thick and thin tile counts at a level, the numbers the golden-ratio sketch
// shows. These equal faces.ts substitutionFaces at every level (same rhombi).
export type Counts = { level: number; thick: number; thin: number; ratio: number };

export function countsAt(level: number): Counts {
  let thick = 0;
  let thin = 0;
  for (const r of rhombiAt(level)) {
    if (r.kind === "thick") thick++;
    else thin++;
  }
  return { level, thick, thin, ratio: thin === 0 ? Infinity : thick / thin };
}

// The full count series the golden-ratio sketch steps through. The trend is the
// teaching point: |ratio - phi| at the top level is far smaller than at the
// bottom, the ratio homing in on the golden ratio that built the tiles.
export function countSeries(maxLevel: number): Counts[] {
  const out: Counts[] = [];
  for (let l = 1; l <= maxLevel; l++) out.push(countsAt(l));
  return out;
}

// One depth of the hierarchy sketch: the small filled rhombi (level L) and the
// supertiles they compose into (level L-1), the genuine level-up tiles. Both come
// from deflate at the same wheel radius, so the small tiles sit inside their
// supertiles with no fitting by hand.
export type Hierarchy = { level: number; small: Rhombus[]; supers: Rhombus[] };

export function hierarchyAt(level: number): Hierarchy {
  return { level, small: rhombiAt(level), supers: rhombiAt(level - 1) };
}

// Shared extent for fitting a patch into a viewBox: the max |coordinate| over all
// corners. The wheel is origin-centered, so a single half-extent frames it.
export function halfExtent(rhombi: readonly Rhombus[]): number {
  let h = 0;
  for (const r of rhombi)
    for (const [x, y] of r.corners) h = Math.max(h, Math.abs(x), Math.abs(y));
  return h;
}
