"use client";

import { useMemo, useState } from "react";

import Sketch from "./Sketch";
import {
  buildPatch,
  rejectedPoints,
  windowPolygon,
  INDICES,
  WINDOW,
  type Pt,
  type SketchTile,
} from "./lib/cutProject";
import { index } from "../explore/lib/cap";

// "So you solve it globally": the spine's section-6 sketch, two linked panels.
//
// LEFT, physical space: a real Penrose patch, the same tiles the explorer paints,
// straight from the pentagrid enumerator at the pinned window center. RIGHT,
// internal "shadow" space: the acceptance window (four nested pentagons by index),
// the bounded region the whole tiling is decided against.
//
// The teaching move is the link. Hover a tile on the left; on the right its four
// corner ℤ⁵ points cast their shadows (internal projection) and every one lands
// INSIDE the window. That is the whole rule: a lattice point is a tiling vertex
// iff its shadow is in the window, a test local to the point. Faint dots outside
// the window are real ℤ⁵ points the plane discards, shadow outside, gone. Walk the
// plane forever (left is unbounded) and the shadow never leaves this little region
// (right is bounded). No walk, no backtrack, no strand.
//
// Static SVG with hover: theme colors are CSS var() references so the panels invert
// with the toggle for free, and a static sketch honors reduced-motion by
// construction (the harness adds no clock). The address under the cursor is the
// tile's own ℤ⁵ coordinate.

const VB_W = 720;
const VB_H = 380;
const GUTTER = 28;
const PAD = 26;
const PANEL_W = (VB_W - GUTTER) / 2;

const pointsAttr = (pts: readonly Pt[]) => pts.map(([x, y]) => `${x},${y}`).join(" ");

// A fit: map a data-space box into a panel box, y flipped (SVG y grows down),
// preserving aspect so circles stay circles. Coordinates are rounded to 0.001 px: they
// derive from Math.cos/sin/sqrt, whose last bit differs between the SSR runtime (Node)
// and the browser (V8), and an unrounded value in an SVG attribute is a hydration
// mismatch. Sub-pixel rounding is invisible and makes server and client byte-identical.
type Fit = (p: Pt) => [number, number];
const px3 = (n: number) => Math.round(n * 1000) / 1000;
function makeFit(
  data: { cx: number; cy: number; half: number },
  panel: { x: number; y: number; w: number; h: number },
): Fit {
  const s = Math.min(panel.w, panel.h) / (2 * data.half);
  const px0 = panel.x + panel.w / 2;
  const py0 = panel.y + panel.h / 2;
  return ([x, y]) => [px3(px0 + (x - data.cx) * s), px3(py0 - (y - data.cy) * s)];
}

// Left panel: the physical patch. Fit its corner extent into the left box.
function physicalView(patch: SketchTile[]): { fit: Fit } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of patch)
    for (const [x, y] of t.physical) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY) / 2 + 0.3;
  const fit = makeFit(
    { cx, cy, half },
    { x: PAD, y: PAD, w: PANEL_W - 2 * PAD, h: VB_H - 2 * PAD },
  );
  return { fit };
}

// Right panel: internal space. The window spans ~±τ around its center; fit that.
function internalView(): { fit: Fit } {
  const TAU = (1 + Math.sqrt(5)) / 2;
  const fit = makeFit(
    { cx: WINDOW.vx, cy: WINDOW.vy, half: TAU + 0.25 },
    { x: PANEL_W + GUTTER + PAD, y: PAD, w: PANEL_W - 2 * PAD, h: VB_H - 2 * PAD },
  );
  return { fit };
}

export default function CutAndProject() {
  const patch = useMemo(() => buildPatch(), []);
  const rejected = useMemo(() => rejectedPoints(), []);
  const { fit: fitL } = useMemo(() => physicalView(patch), [patch]);
  const { fit: fitR } = useMemo(() => internalView(), []);

  // A representative tile, highlighted by default so the static (and reduced-motion)
  // frame already tells the story: one tile lit, its four shadows inside the window.
  const seed = useMemo(() => {
    let best = patch[0];
    let bestD = Infinity;
    for (const t of patch) {
      const [cx, cy] = t.physical[0];
      const d = Math.hypot(cx, cy);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best?.key ?? null;
  }, [patch]);

  const [hover, setHover] = useState<string | null>(null);
  const active = patch.find((t) => t.key === (hover ?? seed)) ?? null;

  // Window pentagons, faint, largest first so smaller ones read on top.
  const windowPolys = INDICES.map((idx) => ({
    idx,
    pts: windowPolygon(idx).map(fitR),
  })).sort((a, b) => b.idx - a.idx);

  const fillFor = (t: SketchTile) =>
    t.type === "thick" ? "var(--color-penrose-thick)" : "var(--color-penrose-thin)";

  const addr = active
    ? `${active.coord.join(", ")}  ·  ${active.type}`
    : "hover a tile";

  return (
    <Sketch label="sketch 06 · cut and project from ℤ⁵">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="block w-full h-auto bg-paper"
        role="img"
        aria-label="Two linked panels. Left: a real Penrose patch in physical space, the tiling the explorer paints. Right: internal shadow space, four nested pentagons by index forming the acceptance window. Hovering a tile on the left lights it and plots the internal projection of its four corner integer-lattice points on the right, all landing inside the window, which is why the tile is accepted. Faint points outside the window are lattice points whose shadow lands outside, discarded. Physical space is unbounded but the shadow stays trapped in this little window, so the accept test is local and the plane never strands."
      >
        {/* hairline divider between the panels */}
        <line
          x1={PANEL_W + GUTTER / 2}
          y1={PAD * 0.6}
          x2={PANEL_W + GUTTER / 2}
          y2={VB_H - PAD * 0.6}
          stroke="var(--color-ink)"
          strokeWidth={1}
          opacity={0.25}
        />

        {/* panel titles */}
        <text
          x={PAD}
          y={16}
          className="font-mono"
          fontSize={10}
          letterSpacing="0.12em"
          fill="var(--color-ink)"
          opacity={0.55}
        >
          PHYSICAL · THE TILING
        </text>
        <text
          x={PANEL_W + GUTTER + PAD}
          y={16}
          className="font-mono"
          fontSize={10}
          letterSpacing="0.12em"
          fill="var(--color-ink)"
          opacity={0.55}
        >
          INTERNAL · THE SHADOW WINDOW
        </text>

        {/* LEFT: the real patch. Every tile drawn at physical() of its corners. */}
        <g>
          {patch.map((t) => {
            const lit = active?.key === t.key;
            return (
              <polygon
                key={t.key}
                points={pointsAttr(t.physical.map(fitL))}
                fill={fillFor(t)}
                fillOpacity={lit ? 1 : 0.82}
                stroke="var(--color-ink)"
                strokeWidth={lit ? 2 : 0.8}
                strokeLinejoin="round"
                opacity={active && !lit ? 0.5 : 1}
                onMouseEnter={() => setHover(t.key)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer", transition: "opacity 0.12s ease" }}
              />
            );
          })}
          {/* the lit tile's four corners, marked, to tie them to the right panel */}
          {active &&
            active.physical.map(fitL).map(([x, y], i) => (
              <circle
                key={`lc-${i}`}
                cx={x}
                cy={y}
                r={3}
                fill="var(--color-ink)"
              />
            ))}
        </g>

        {/* RIGHT: the acceptance window and the shadows. */}
        <g>
          {/* the four index windows, faint, drawn as ink outlines */}
          {windowPolys.map(({ idx, pts }) => (
            <polygon
              key={`w-${idx}`}
              points={pointsAttr(pts)}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth={1}
              opacity={0.28}
            />
          ))}

          {/* rejected lattice points: shadow outside the window, discarded */}
          {rejected.map((r, i) => {
            const [x, y] = fitR(r.internal);
            return (
              <g key={`rej-${i}`} opacity={0.4}>
                <line
                  x1={x - 3.5}
                  y1={y - 3.5}
                  x2={x + 3.5}
                  y2={y + 3.5}
                  stroke="var(--color-ink)"
                  strokeWidth={1}
                />
                <line
                  x1={x - 3.5}
                  y1={y + 3.5}
                  x2={x + 3.5}
                  y2={y - 3.5}
                  stroke="var(--color-ink)"
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {/* the lit tile's shadow rhombus: its four corner shadows joined. Note the
              shape flips, a thick tile casts a thin-shaped shadow and the reverse,
              because internal space turns each edge by twice the angle physical does. */}
          {active && (
            <polygon
              points={pointsAttr(active.internal.map(fitR))}
              fill={fillFor(active)}
              fillOpacity={0.18}
              stroke={fillFor(active)}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          )}

          {/* the lit tile's four shadows, landing inside the window */}
          {active &&
            active.internal.map(fitR).map(([x, y], i) => {
              const idx = index(active.cornerCoords[i]);
              return (
                <circle
                  key={`sh-${i}`}
                  cx={x}
                  cy={y}
                  r={4}
                  fill="var(--color-ink)"
                  stroke="var(--color-paper)"
                  strokeWidth={1.2}
                >
                  <title>{`corner shadow, index ${idx}, inside the window`}</title>
                </circle>
              );
            })}
        </g>
      </svg>

      <div className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5]">
        <p aria-live="polite">
          {active ? (
            <>
              This tile is the shadow of lattice point{" "}
              <span className="font-mono">[{addr}]</span>. Its four corners&#39;
              shadows all land inside the window, so the plane keeps it. Notice the
              shadow is the other shape: a fat tile casts a thin outline, a thin tile
              a fat one, because internal space turns each edge by twice the angle
              physical space does. The crossed points are lattice points whose shadow
              lands outside, so the plane discards them.
            </>
          ) : (
            "Hover a tile. Its four 5D corners cast shadows into the window on the right; all inside means accepted."
          )}
        </p>
        <p className="mt-2 opacity-70">
          Walk anywhere on the left and the plane never ends. The shadows on the
          right never leave this little window. That boundedness is the whole
          tiling, and the test is local to each point, so the build never strands.
          The address is just the ℤ⁵ coordinate.
        </p>
      </div>
    </Sketch>
  );
}
