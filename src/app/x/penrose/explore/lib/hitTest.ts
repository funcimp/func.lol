// src/app/x/penrose/explore/lib/hitTest.ts
// Point to tile, accelerated by a uniform spatial grid. Tiles are ~unit sized in
// the pos frame, so a cell near 1.5 units keeps buckets small. Each face is
// bucketed into every cell its bounding box overlaps; a query tests only its
// own cell. Faces are non-overlapping, so the first containing face wins.

import type { Pt, RenderFace } from "./patch";

export type HitIndex = { cell: number; grid: Map<string, RenderFace[]> };

const cellKey = (cx: number, cy: number) => `${cx},${cy}`;

export function buildHitIndex(faces: readonly RenderFace[], cell = 1.5): HitIndex {
  const grid = new Map<string, RenderFace[]>();
  for (const f of faces) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of f.corners) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const cx0 = Math.floor(minX / cell), cx1 = Math.floor(maxX / cell);
    const cy0 = Math.floor(minY / cell), cy1 = Math.floor(maxY / cell);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const key = cellKey(cx, cy);
        const bucket = grid.get(key);
        if (bucket) bucket.push(f);
        else grid.set(key, [f]);
      }
    }
  }
  return { cell, grid };
}

function pointInQuad(px: number, py: number, q: readonly [Pt, Pt, Pt, Pt]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const cross = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
    if (cross !== 0) {
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

export function hitFace(index: HitIndex, x: number, y: number): RenderFace | null {
  const cx = Math.floor(x / index.cell), cy = Math.floor(y / index.cell);
  const bucket = index.grid.get(cellKey(cx, cy));
  if (!bucket) return null;
  for (const f of bucket) {
    if (pointInQuad(x, y, f.corners)) return f;
  }
  return null;
}
