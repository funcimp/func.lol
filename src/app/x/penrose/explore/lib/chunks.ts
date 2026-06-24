// Physical-space chunk cache over the pentagrid enumerator. Cells are squares of side
// CELL in the physical (render) frame. A cell owns tiles whose physical(K) centroid is
// in its half-open [min,max) bounds, so the union over cells is seam-free (each tile in
// exactly one cell). Cells are generated on demand and LRU-evicted when far from the view.

import { facesInViewport, type Rect } from "./pentagrid";
import type { RenderFace } from "./patch";

export const CELL = 8;
const KEEP_RING = 1; // generate one ring of cells beyond the viewport
const MAX_CELLS = 4096; // evict beyond this many cached cells

const cellKey = (cx: number, cy: number) => `${cx},${cy}`;

export class ChunkCache {
  private cells = new Map<string, RenderFace[]>();
  private order: string[] = []; // simple LRU queue of cell keys

  constructor(private gamma: readonly number[]) {}

  get size(): number {
    return this.cells.size;
  }

  private cellFaces(cx: number, cy: number): RenderFace[] {
    const key = cellKey(cx, cy);
    const hit = this.cells.get(key);
    if (hit) return hit;
    // Generate the cell: enumerate over the cell's physical bounds, then keep tiles whose
    // centroid is in this cell's half-open bounds. facesInViewport already grows the search
    // region by its grid + physical margins, so every tile touching the cell is enumerated.
    const minX = cx * CELL,
      minY = cy * CELL,
      maxX = minX + CELL,
      maxY = minY + CELL;
    const faces = facesInViewport({ minX, minY, maxX, maxY }, this.gamma).filter(
      (f) =>
        f.centroid[0] >= minX &&
        f.centroid[0] < maxX &&
        f.centroid[1] >= minY &&
        f.centroid[1] < maxY,
    );
    this.cells.set(key, faces);
    this.order.push(key);
    if (this.cells.size > MAX_CELLS) {
      const evict = this.order.shift();
      if (evict && evict !== key) this.cells.delete(evict);
    }
    return faces;
  }

  facesInView(view: Rect): RenderFace[] {
    const cx0 = Math.floor(view.minX / CELL) - KEEP_RING;
    const cx1 = Math.floor(view.maxX / CELL) + KEEP_RING;
    const cy0 = Math.floor(view.minY / CELL) - KEEP_RING;
    const cy1 = Math.floor(view.maxY / CELL) + KEEP_RING;
    const out: RenderFace[] = [];
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) out.push(...this.cellFaces(cx, cy));
    }
    return out;
  }
}
