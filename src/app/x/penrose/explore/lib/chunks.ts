// Physical-space chunk cache over the pentagrid enumerator. Cells are squares of side
// CELL in the physical (render) frame. A cell owns tiles whose physical(K) centroid is
// in its half-open [min,max) bounds, so the union over cells is seam-free (each tile in
// exactly one cell). Cells are generated on demand and evicted once they fall outside the
// viewport plus a margin, so the cache stays bounded to what the view can reach.

import { facesInViewport, type Rect } from "./pentagrid";
import type { RenderFace } from "./patch";

export const CELL = 8;
const KEEP_RING = 1; // generate one ring of cells beyond the viewport
// Derived so the evict band sits strictly outside the keep band by construction.
const EVICT_MARGIN = KEEP_RING + 3;

const cellKey = (cx: number, cy: number) => `${cx},${cy}`;

export class ChunkCache {
  private cells = new Map<string, RenderFace[]>();
  // Memo of the last visible cell window and its assembled faces. An unchanged
  // integer window returns the cached array and skips both re-concat and eviction.
  private lastWindow: [number, number, number, number] | null = null;
  private lastFaces: RenderFace[] = [];

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
    return faces;
  }

  facesInView(view: Rect): RenderFace[] {
    const cx0 = Math.floor(view.minX / CELL) - KEEP_RING;
    const cx1 = Math.floor(view.maxX / CELL) + KEEP_RING;
    const cy0 = Math.floor(view.minY / CELL) - KEEP_RING;
    const cy1 = Math.floor(view.maxY / CELL) + KEEP_RING;
    // Unchanged window: nothing to re-concat and nothing to evict. Return the cached array.
    const last = this.lastWindow;
    if (last && last[0] === cx0 && last[1] === cx1 && last[2] === cy0 && last[3] === cy1) {
      return this.lastFaces;
    }
    const out: RenderFace[] = [];
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) out.push(...this.cellFaces(cx, cy));
    }
    // Evict everything past the viewport plus EVICT_MARGIN. The cache is bounded to the
    // visible window plus a ring, and no visible cell is ever evicted because EVICT_MARGIN
    // exceeds KEEP_RING. The min zoom on a large display no longer thrashes a fixed cap.
    const keepX0 = cx0 - EVICT_MARGIN, keepX1 = cx1 + EVICT_MARGIN;
    const keepY0 = cy0 - EVICT_MARGIN, keepY1 = cy1 + EVICT_MARGIN;
    for (const key of this.cells.keys()) {
      const comma = key.indexOf(",");
      const cx = Number(key.slice(0, comma));
      const cy = Number(key.slice(comma + 1));
      if (cx < keepX0 || cx > keepX1 || cy < keepY0 || cy > keepY1) this.cells.delete(key);
    }
    this.lastWindow = [cx0, cx1, cy0, cy1];
    this.lastFaces = out;
    return out;
  }
}
