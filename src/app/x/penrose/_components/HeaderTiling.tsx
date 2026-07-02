import { suns } from "../explore/lib/motifs";
import type { Pt } from "../explore/lib/patch";
import { facesInViewport, GAMMA, type Rect } from "../explore/lib/pentagrid";

// The header image: a real strip of the same tiling every sketch and the
// explorer draw, generated server-side from the pentagrid engine. A rosette
// (sun) is anchored in the left third so the strip opens on the motif the eye
// catches first. Decorative only (aria-hidden): everything shown here is
// taught properly further down the page.
//
// Server component on purpose: the strip is a pure function of the engine, so
// it renders once as static SVG with no client bundle. Fills are CSS vars, so
// it inverts with the theme like everything else. Coordinates are rounded to
// keep the SSR output identical across platforms (trig floats differ in the
// last bit between arm64 and x64).

const W = 720;
const H = 208;
const SCALE = 46; // px per unit edge
const WORLD_W = W / SCALE;
const WORLD_H = H / SCALE;

function buildStrip(): { type: "thick" | "thin"; points: string }[] {
  // find the sun nearest the origin and anchor it a third of the way in
  const scout: Rect = { minX: -9, minY: -9, maxX: 9, maxY: 9 };
  const centers = suns(facesInViewport(scout, GAMMA));
  const anchor: Pt = centers.reduce(
    (a, b) => (Math.hypot(a[0], a[1]) <= Math.hypot(b[0], b[1]) ? a : b),
    centers[0] ?? ([0, 0] as Pt),
  );
  const cx = anchor[0] + WORLD_W / 6;
  const cy = anchor[1];
  const view: Rect = {
    minX: cx - WORLD_W / 2 - 1,
    maxX: cx + WORLD_W / 2 + 1,
    minY: cy - WORLD_H / 2 - 1,
    maxY: cy + WORLD_H / 2 + 1,
  };
  const toPx = ([x, y]: Pt): string =>
    `${(W / 2 + (x - cx) * SCALE).toFixed(2)},${(H / 2 - (y - cy) * SCALE).toFixed(2)}`;
  return facesInViewport(view, GAMMA).map((f) => ({
    type: f.type,
    points: f.corners.map(toPx).join(" "),
  }));
}

const STRIP = buildStrip();

export default function HeaderTiling() {
  return (
    <div aria-hidden="true" className="mb-9">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="block w-full h-auto"
      >
        {STRIP.map((t) => (
          <polygon
            key={t.points}
            points={t.points}
            fill={
              t.type === "thick"
                ? "var(--color-penrose-thick)"
                : "var(--color-penrose-thin)"
            }
            stroke="var(--color-paper)"
            strokeWidth={1}
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
}
