// Data for the interference-overlay sketch (spine section 7, "Slide one over
// another"). This is Penrose's overhead-projector demo: lay two of these tilings
// over each other, turn one, and broad regions snap into agreement while veins of
// mismatch ripple between them, all organized by the five-fold symmetry.
//
// Honesty is the whole point, so BOTH layers are real enumerator output. Layer A is
// a real patch from facesInViewport at the pinned window center, drawn filled. Layer
// B is the SAME real patch, drawn as edges, and rotated about the patch center by
// the slider. Rotating a Penrose tiling by a non-symmetry angle yields another valid
// Penrose tiling in a new orientation, which is exactly the transparency Penrose
// turned on his projector. Nothing here is hand-drawn or randomized.
//
// The interference is EMERGENT. Overlay the two and the agreement islands and veins
// appear to the eye on their own. We additionally label agreement only where it is
// REAL: a layer-A tile is "coincident" at a given angle iff some rotated layer-B
// tile of the same kind lands within COINCIDE_TOL of it. That set is what the sketch
// may tint, and what the colocated test pins, so no highlight is ever painted on.

import { facesInViewport, GAMMA } from "../../explore/lib/pentagrid";
import type { Pt, RenderFace } from "../../explore/lib/patch";

export type { Pt } from "../../explore/lib/patch";

// A square patch around the origin: enough tiles for the moiré to read, few enough
// to draw every edge cleanly. The center of rotation is the origin, the patch center.
// half defaults to a modest patch (the test reads this); the sketch asks for a larger,
// zoomed-out patch so the five-fold interference shows at scale.
const DEFAULT_HALF = 8.5;

// Two tiles of the same kind whose centers fall within this distance (physical
// units, edge length 1) count as coincident: the same tile in the same place. Set
// well below the smallest tile-to-tile spacing so a match means genuine overlap, not
// a near neighbor. Validated by overlay.test.ts against the patch's spacing.
export const COINCIDE_TOL = 0.16;

// One fifth-turn. The slider spans [0, FIFTH]; the five-fold symmetry means the
// moiré over this range is the whole story, and the angle reads as a fraction of the
// symmetry that built the tiles.
export const FIFTH = (2 * Math.PI) / 5;

export type Overlay = {
  // Layer A, filled rhombi, the real patch in its home orientation.
  a: RenderFace[];
  // Layer B, the same real patch, drawn as edges and rotated at render time. Carried
  // separately so the sketch can transform B without touching A.
  b: RenderFace[];
};

// Build the overlay: layer A and layer B are the SAME real enumerator patch. They
// are distinct arrays so the renderer can rotate B's geometry independently. The
// patch is sorted by key for determinism (the test reads buildOverlay() too).
export function buildOverlay(half = DEFAULT_HALF): Overlay {
  const view = { minX: -half, minY: -half, maxX: half, maxY: half };
  const faces = facesInViewport(view, GAMMA).sort((x, y) => x.key.localeCompare(y.key));
  return { a: faces, b: faces };
}

// Rotate a point about the origin (the patch center) by `angle` radians.
export function rotate(p: Pt, angle: number): Pt {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

// The set of layer-A tile keys that genuinely coincide with a rotated layer-B tile
// at `angle`: same rhombus kind, centers within COINCIDE_TOL. This is the only thing
// the sketch may tint as "agreement," and it reflects real near-coincidence under
// the current transform, computed from the two real patches. A spatial hash over
// rotated B centroids keeps it linear in the tile count.
export function coincidentKeys(o: Overlay, angle: number, tol = COINCIDE_TOL): Set<string> {
  const cell = Math.max(tol, 0.5);
  const grid = new Map<string, Pt[]>();
  const cellKey = (x: number, y: number) => `${Math.round(x / cell)},${Math.round(y / cell)}`;
  for (const f of o.b) {
    const r = rotate(f.centroid, angle);
    // Bucket by kind so a thick never matches a thin.
    const k = `${f.type}:${cellKey(r[0], r[1])}`;
    const arr = grid.get(k);
    if (arr) arr.push(r);
    else grid.set(k, [r]);
  }
  const out = new Set<string>();
  const tol2 = tol * tol;
  for (const f of o.a) {
    const [cx, cy] = f.centroid;
    const bx = Math.round(cx / cell);
    const by = Math.round(cy / cell);
    let hit = false;
    for (let dx = -1; dx <= 1 && !hit; dx++) {
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        const bucket = grid.get(`${f.type}:${bx + dx},${by + dy}`);
        if (!bucket) continue;
        for (const [rx, ry] of bucket) {
          const ex = cx - rx;
          const ey = cy - ry;
          if (ex * ex + ey * ey <= tol2) {
            hit = true;
            break;
          }
        }
      }
    }
    if (hit) out.add(f.key);
  }
  return out;
}

// The four edge lengths of a rhombus face, in physical units. Used by the test to
// prove every drawn tile is a unit-edge rhombus, the engine's only output.
export function edgeLengths(f: RenderFace): [number, number, number, number] {
  const c = f.corners;
  const len = (i: number): number => {
    const p = c[i];
    const q = c[(i + 1) % 4];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  };
  return [len(0), len(1), len(2), len(3)];
}

// Thick:thin ratio over a set of faces. Over a real Penrose patch this tends to φ.
export function thickThinRatio(faces: readonly RenderFace[]): number {
  let thick = 0;
  let thin = 0;
  for (const f of faces) {
    if (f.type === "thick") thick++;
    else thin++;
  }
  return thin === 0 ? Infinity : thick / thin;
}
