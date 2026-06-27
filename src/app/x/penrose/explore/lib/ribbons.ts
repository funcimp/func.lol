// src/app/x/penrose/explore/lib/ribbons.ts
// de Bruijn ribbons (Conway worms): the bands of tiles threaded by one pentagrid line.
//
// A tile [coord; j,k] sits at the crossing of the family-j line (at level coord[j]) and
// the family-k line (at level coord[k]). So the tiles sharing one family-f line are the
// tiles with f in {j,k} and coord[f] equal to that line's level. Group them by level and
// each group is a ribbon: a long, ~one-tile-thick band running perpendicular to direction
// f, threading the whole patch. Every tile belongs to exactly two ribbons, one per axis.
//
// This is the engine-native "higher-order pattern": five families of bands, one per edge
// direction, arranged quasiperiodically. The famous Ammann bars are the straight lines
// that idealize these bands. Built purely from facesInViewport output, bound by ribbons.test.ts.

import type { RenderFace } from "./patch";

export type Ribbon = { family: number; level: number; faces: RenderFace[] };

// All ribbons of one family (0..4), sorted by line level. Each ribbon's tiles all share
// the family-f line at that level.
export function ribbonsForFamily(faces: readonly RenderFace[], family: number): Ribbon[] {
  const byLevel = new Map<number, RenderFace[]>();
  for (const f of faces) {
    if (f.j !== family && f.k !== family) continue;
    const m = f.coord[family];
    const arr = byLevel.get(m);
    if (arr) arr.push(f);
    else byLevel.set(m, [f]);
  }
  return [...byLevel.entries()]
    .map(([level, fs]) => ({ family, level, faces: fs }))
    .sort((a, b) => a.level - b.level);
}
