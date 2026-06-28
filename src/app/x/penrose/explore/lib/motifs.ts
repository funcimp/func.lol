// src/app/x/penrose/explore/lib/motifs.ts
// Recurring local motifs in a Penrose tiling. The most legible is the SUN: a vertex
// where five thick rhombi meet at their 72-degree corners (5 x 72 = 360), forming a
// five-petal flower. These pop out to the eye before any deeper structure, so the early
// "patterns" sketch glows them. Detected straight from facesInViewport output (a vertex
// with exactly five incident tiles, all thick). Bound by motifs.test.ts.

import type { RenderFace, Pt } from "./patch";

const vkey = (p: Pt) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;

// Centres of all sun vertices in the patch.
export function suns(faces: readonly RenderFace[]): Pt[] {
  const inc = new Map<string, { pos: Pt; thick: number; total: number }>();
  for (const f of faces) {
    for (const c of f.corners) {
      const k = vkey(c);
      const e = inc.get(k) ?? { pos: c, thick: 0, total: 0 };
      e.total++;
      if (f.type === "thick") e.thick++;
      inc.set(k, e);
    }
  }
  return [...inc.values()].filter((e) => e.total === 5 && e.thick === 5).map((e) => e.pos);
}
