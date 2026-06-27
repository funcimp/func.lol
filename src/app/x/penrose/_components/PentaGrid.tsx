"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import { PCOS, PSIN } from "../explore/lib/cap";
import {
  GAMMA,
  pentagridView,
  type GridCrossing,
  type GridLine,
  type Rect,
} from "../explore/lib/pentagrid";

// "Tiles fall out of a grid of lines": de Bruijn's pentagrid, the dual of cut and
// project. Five families of evenly spaced parallel lines, one per pentagon direction.
// Every crossing of two families IS one tile: a shallow 72 degree crossing makes a
// thick rhombus, a steep 144 degree crossing makes a thin one. Each crossing is one
// square face of the five-dimensional cube lattice, and the rhombus is that face's
// shadow on the plane, so the tiles literally fall out of the higher-dimensional grid.
//
// Left panel: the pentagrid in grid space, lines plus their crossings. Right panel:
// the tiling in the plane, one rhombus per crossing. A radial sweep reveals crossing
// and rhombus in lockstep so the correspondence is visible, and one featured crossing
// stays linked to its tile by a drawn connector. This is the real de Bruijn bijection,
// not an analogy: the crossings and faces come from pentagridView(), the same engine
// the explorer runs, and every crossing maps to a tile that actually exists.
//
// HONEST BY CONSTRUCTION. pentagridView() solves each crossing and builds its face with
// the exact solveCrossing / corners4 / rhombusType the production facesInViewport uses;
// a numeric check confirms every crossing sits on its two lines and names a real tile,
// and that every tile facesInViewport emits appears as a crossing. The two panels show
// the same world in its two frames (grid space and the plane), related by the fixed
// physical = (5/2)z map, so a crossing and its tile sit at matching panel positions.
//
// Canvas: the harness drives render(t); t = 1 is the finished grid and tiling with the
// featured crossing linked. Reduced motion mounts at t = 1.

const VB_W = 720;
const VB_H = 384;

const PANEL = 320;
const TOP = 50; // room for the captions
const X0L = 24; // left panel left edge
const X0R = VB_W - 24 - PANEL; // right panel left edge (376)

// The physical viewport both panels portray. r = 3.4 gives ~56 tiles over 30 lines:
// dense enough that "every crossing becomes a tile" reads, sparse enough to follow.
const PHYS_R = 3.4;
const VIEW: Rect = { minX: -PHYS_R, minY: -PHYS_R, maxX: PHYS_R, maxY: PHYS_R };

// Anchor for the featured crossing: a thick crossing near here is held linked to its
// tile through the whole animation, off-centre so it dodges the central five-fold star.
const FEATURE_ANCHOR: readonly [number, number] = [1.15, 0.55];

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (e0: number, e1: number, x: number): number => {
  const u = clamp01((x - e0) / (e1 - e0));
  return u * u * (3 - 2 * u);
};

// physical(gamma): the constant offset between grid space and the plane.
function physicalGamma(): [number, number] {
  let x = 0, y = 0;
  for (let l = 0; l < 5; l++) { x += GAMMA[l] * PCOS[l]; y += GAMMA[l] * PSIN[l]; }
  return [x, y];
}

type View = {
  lines: GridLine[];
  drawn: GridCrossing[]; // crossings to render: every one has a dot AND a rhombus
  inViewCount: { thick: number; thin: number }; // tiles fully inside the plane window
  featured: GridCrossing | null;
  maxDist: number; // largest drawn tile-centroid distance, for the radial sweep
  leftToPx: (z: readonly [number, number]) => [number, number];
  rightToPx: (p: readonly [number, number]) => [number, number];
};

// Build the panels' geometry once. Both map the same physical view; the left panel maps
// the grid-space rectangle z = (2/5)(view - physicalGamma), so a crossing and its tile
// land at the same fractional position in their panels (physical = (5/2)z + offset).
//
// The drawn set is the union of two windows so both panels are airtight under clipping:
// crossings whose z falls in the left panel's grid rect (so no line crossing in the left
// panel is ever dotless), and crossings whose tile centroid falls in the right panel's
// plane window (so the tiling has no edge gaps). Same set drives dots and rhombi, so the
// "one rhombus per crossing" bijection is visible, not asserted.
function buildView(): View {
  const pv = pentagridView(VIEW, GAMMA);
  const [pgx, pgy] = physicalGamma();
  const zMinX = (2 / 5) * (VIEW.minX - pgx);
  const zMaxX = (2 / 5) * (VIEW.maxX - pgx);
  const zMinY = (2 / 5) * (VIEW.minY - pgy);
  const zMaxY = (2 / 5) * (VIEW.maxY - pgy);
  const zSpan = (2 / 5) * (VIEW.maxX - VIEW.minX);
  const sL = PANEL / zSpan;
  const leftToPx = (z: readonly [number, number]): [number, number] => [
    X0L + (z[0] - zMinX) * sL,
    TOP + (zMaxY - z[1]) * sL,
  ];

  const sR = PANEL / (VIEW.maxX - VIEW.minX);
  const rightToPx = (p: readonly [number, number]): [number, number] => [
    X0R + (p[0] - VIEW.minX) * sR,
    TOP + (VIEW.maxY - p[1]) * sR,
  ];

  const inPanel = (c: GridCrossing) =>
    c.z[0] >= zMinX && c.z[0] <= zMaxX && c.z[1] >= zMinY && c.z[1] <= zMaxY;
  const inView = (c: GridCrossing) => {
    const [x, y] = c.face.centroid;
    return x >= VIEW.minX && x <= VIEW.maxX && y >= VIEW.minY && y <= VIEW.maxY;
  };

  const drawn = pv.crossings.filter((c) => inPanel(c) || inView(c));
  let maxDist = 0;
  for (const c of drawn) maxDist = Math.max(maxDist, Math.hypot(c.face.centroid[0], c.face.centroid[1]));

  const inViewCount = { thick: 0, thin: 0 };
  for (const c of pv.crossings) {
    if (!inView(c)) continue;
    if (c.face.type === "thick") inViewCount.thick++;
    else inViewCount.thin++;
  }

  let featured: GridCrossing | null = null;
  let best = Infinity;
  for (const c of drawn) {
    if (c.face.type !== "thick") continue;
    const d = Math.hypot(c.face.centroid[0] - FEATURE_ANCHOR[0], c.face.centroid[1] - FEATURE_ANCHOR[1]);
    if (d < best) { best = d; featured = c; }
  }

  return { lines: pv.lines, drawn, inViewCount, featured, maxDist, leftToPx, rightToPx };
}

// A crossing's two lines, looked up from the line set so the highlight is the very
// segment that meets at the crossing (family j at m = K[j], family k at m = K[k]).
function linesFor(v: View, cr: GridCrossing | null): GridLine[] {
  if (!cr) return [];
  const { j, k, face } = cr;
  return v.lines.filter(
    (ln) => (ln.l === j && ln.m === face.coord[j]) || (ln.l === k && ln.m === face.coord[k]),
  );
}

// Even-odd point-in-quadrilateral, for hit-testing a rhombus under the cursor.
function pointInQuad(x: number, y: number, q: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const [xi, yi] = q[i];
    const [xj, yj] = q[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function strokeSeg(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number]) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function panelFrame(ctx: CanvasRenderingContext2D, x0: number, ink: string) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, TOP, PANEL, PANEL);
  ctx.restore();
}

function caption(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  align: CanvasTextAlign,
  alpha = 1,
  size = 11,
  bold = false,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `${bold ? "600 " : ""}${size}px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
  ctx.restore();
}

export default function PentaGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({
    thick: "#C89B3C",
    thin: "#3E6B7C",
    paper: "#0f0e0c",
    ink: "#ede9d8",
  });
  const dprRef = useRef(0);
  const lastTRef = useRef(1);

  const view = useMemo(() => buildView(), []);
  const hoverRef = useRef<GridCrossing | null>(null);

  const refreshColors = useCallback(() => {
    colorsRef.current = {
      thick: readVar("--color-penrose-thick", "#C89B3C"),
      thin: readVar("--color-penrose-thin", "#3E6B7C"),
      paper: readVar("--color-paper", "#0f0e0c"),
      ink: readVar("--color-ink", "#ede9d8"),
    };
  }, []);

  const render = useCallback(
    (t: number) => {
      lastTRef.current = t;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      if (dpr !== dprRef.current) {
        dprRef.current = dpr;
        canvas.width = VB_W * dpr;
        canvas.height = VB_H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        refreshColors();
      }

      const colors = colorsRef.current;
      const { thick, thin, ink, paper } = colors;
      const colorFor = (type: "thick" | "thin") => (type === "thick" ? thick : thin);

      ctx.clearRect(0, 0, VB_W, VB_H);
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, VB_W, VB_H);

      panelFrame(ctx, X0L, ink);
      panelFrame(ctx, X0R, ink);

      const band = 0.14;
      const sweep = clamp01((t - 0.12) / (0.9 - 0.12));
      const scanR = sweep * (1 + band + 0.05);
      const lineAlpha = smooth(0, 0.1, t);
      // The highlighted crossing is whatever the cursor is over, else the default
      // featured one. Hover a tile or a crossing and its partner lights up.
      const hovering = hoverRef.current;
      const highlight = hovering ?? view.featured;
      const isHi = (c: GridCrossing) => highlight !== null && c.face.key === highlight.face.key;

      // Reveal fraction for one crossing by the radial wavefront (highlight: always on).
      const revealOf = (c: GridCrossing): number => {
        if (isHi(c)) return 1;
        const rNorm = view.maxDist > 0 ? Math.hypot(c.face.centroid[0], c.face.centroid[1]) / view.maxDist : 0;
        return clamp01((scanR - rNorm) / band);
      };

      // LEFT: the pentagrid, clipped to its frame. Faint construction lines, then a
      // crossing dot per tile. Clipping keeps the lines inside the panel so every visible
      // crossing has a dot.
      ctx.save();
      ctx.beginPath();
      ctx.rect(X0L, TOP, PANEL, PANEL);
      ctx.clip();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.32 * lineAlpha;
      for (const ln of view.lines) strokeSeg(ctx, view.leftToPx(ln.a), view.leftToPx(ln.b));
      for (const c of view.drawn) {
        const a = revealOf(c);
        if (a <= 0.01 || isHi(c)) continue;
        const [px, py] = view.leftToPx(c.z);
        ctx.globalAlpha = a;
        ctx.fillStyle = colorFor(c.face.type);
        ctx.beginPath();
        ctx.arc(px, py, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // RIGHT: the tiling, clipped to its frame. One filled rhombus per crossing, gold
      // thick, teal thin.
      ctx.save();
      ctx.beginPath();
      ctx.rect(X0R, TOP, PANEL, PANEL);
      ctx.clip();
      ctx.lineJoin = "round";
      for (const c of view.drawn) {
        const a = revealOf(c);
        if (a <= 0.01 || isHi(c)) continue;
        const pts = c.face.corners.map(view.rightToPx);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.globalAlpha = a;
        ctx.fillStyle = colorFor(c.face.type);
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.globalAlpha = a * 0.5;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
      ctx.restore();

      // The scan wavefront, same pixel radius in both panels (the frames share a scale).
      const ringAlpha = lineAlpha * (1 - smooth(0.85, 1, t));
      if (ringAlpha > 0.01 && view.maxDist > 0) {
        const rPx = scanR * view.maxDist * (PANEL / (VIEW.maxX - VIEW.minX));
        ctx.save();
        ctx.globalAlpha = 0.22 * ringAlpha;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        for (const cx of [X0L + PANEL / 2, X0R + PANEL / 2]) {
          ctx.beginPath();
          ctx.arc(cx, TOP + PANEL / 2, rPx, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // The highlighted crossing: its two lines, its dot, its rhombus, and the connector
      // from the one to the other. The explicit line from a crossing to its tile, on the
      // default featured tile or whatever the cursor is over.
      if (highlight) {
        const col = colorFor(highlight.face.type);
        const hiAlpha = hovering ? 1 : smooth(0.12, 0.3, t);
        const hiLines = linesFor(view, highlight);

        const dot = view.leftToPx(highlight.z);
        ctx.save();
        ctx.beginPath();
        ctx.rect(X0L, TOP, PANEL, PANEL);
        ctx.clip();
        ctx.globalAlpha = hiAlpha;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        for (const ln of hiLines) strokeSeg(ctx, view.leftToPx(ln.a), view.leftToPx(ln.b));
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(dot[0], dot[1], 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(dot[0], dot[1], 5.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        const pts = highlight.face.corners.map(view.rightToPx);
        ctx.save();
        ctx.beginPath();
        ctx.rect(X0R, TOP, PANEL, PANEL);
        ctx.clip();
        ctx.globalAlpha = hiAlpha;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.restore();

        const tile = view.rightToPx(highlight.face.centroid);
        ctx.save();
        ctx.globalAlpha = hiAlpha * 0.85;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.3;
        ctx.setLineDash([5, 4]);
        strokeSeg(ctx, [dot[0] + 7, dot[1]], [tile[0], tile[1]]);
        ctx.setLineDash([]);
        // arrowhead at the tile end
        const ang = Math.atan2(tile[1] - dot[1], tile[0] - dot[0]);
        ctx.beginPath();
        ctx.moveTo(tile[0], tile[1]);
        ctx.lineTo(tile[0] - 7 * Math.cos(ang - 0.4), tile[1] - 7 * Math.sin(ang - 0.4));
        ctx.moveTo(tile[0], tile[1]);
        ctx.lineTo(tile[0] - 7 * Math.cos(ang + 0.4), tile[1] - 7 * Math.sin(ang + 0.4));
        ctx.stroke();
        ctx.restore();

        const gap = highlight.k - highlight.j;
        const deg = gap === 1 || gap === 4 ? 72 : 144;
        caption(
          ctx,
          `this crossing meets at ${deg}° → ${highlight.face.type} tile`,
          VB_W / 2,
          18,
          col,
          "center",
          hiAlpha,
          12,
          true,
        );
      }

      // Panel names.
      caption(ctx, "the pentagrid · five line families", X0L, 40, ink, "left", 0.7);
      caption(ctx, "the tiling · one rhombus per crossing", X0R + PANEL, 40, ink, "right", 0.7);
    },
    [view, refreshColors],
  );

  // Hover hit-test: a tile in the right panel, or a crossing dot in the left. Sets the
  // highlight and repaints at the current time so its partner across the panels lights.
  const onHover = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * VB_W;
      const y = ((e.clientY - rect.top) / rect.height) * VB_H;
      let found: GridCrossing | null = null;
      if (x >= X0R && x <= X0R + PANEL && y >= TOP && y <= TOP + PANEL) {
        for (const c of view.drawn) {
          if (pointInQuad(x, y, c.face.corners.map(view.rightToPx))) { found = c; break; }
        }
      } else if (x >= X0L && x <= X0L + PANEL && y >= TOP && y <= TOP + PANEL) {
        let best = 81; // (9px)^2
        for (const c of view.drawn) {
          const [px, py] = view.leftToPx(c.z);
          const d = (px - x) ** 2 + (py - y) ** 2;
          if (d < best) { best = d; found = c; }
        }
      }
      if ((found?.face.key ?? null) !== (hoverRef.current?.face.key ?? null)) {
        hoverRef.current = found;
        render(lastTRef.current);
      }
    },
    [view, render],
  );

  const onLeave = useCallback(() => {
    if (hoverRef.current) {
      hoverRef.current = null;
      render(lastTRef.current);
    }
  }, [render]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      refreshColors();
      render(lastTRef.current);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [refreshColors, render]);

  const { thick: thickCount, thin: thinCount } = view.inViewCount;
  const ratio = thinCount > 0 ? thickCount / thinCount : 0;

  return (
    <Sketch
      label="sketch 07 · the pentagrid"
      animation={{ duration: 14000, render, slider: { label: "build" } }}
    >
      <canvas
        ref={canvasRef}
        onPointerMove={onHover}
        onPointerLeave={onLeave}
        style={{ width: "100%", height: "auto", aspectRatio: `${VB_W} / ${VB_H}`, cursor: "crosshair", touchAction: "none" }}
        className="block w-full bg-paper"
        role="img"
        aria-label="Two panels showing de Bruijn's pentagrid, the dual of cut and project. On the left, five families of evenly spaced parallel lines in grid space, one family per pentagon direction, with a dot at every crossing of two families. On the right, the Penrose tiling in the plane, with exactly one rhombus per crossing: gold thick rhombi where the lines cross at a shallow 72 degree angle, teal thin rhombi where they cross at a steep 144 degree angle. A radial wavefront sweeps both panels in step, revealing each crossing and its rhombus together, and one featured crossing is linked to its tile by a drawn connector. Every crossing is one square face of the five-dimensional cube lattice and each rhombus is that face's shadow, so the tiles fall out of the higher-dimensional grid."
      />
      <div className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5]">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono">
          <span>
            <span className="opacity-55">tiles in view</span>{" "}
            <span className="font-bold">{thickCount + thinCount}</span>
          </span>
          <span>
            <span className="opacity-55">thick</span>{" "}
            <span className="font-bold">{thickCount}</span>
          </span>
          <span>
            <span className="opacity-55">thin</span>{" "}
            <span className="font-bold">{thinCount}</span>
          </span>
          <span>
            <span className="opacity-55">thick ÷ thin</span>{" "}
            <span className="font-bold">{ratio.toFixed(3)}</span>
          </span>
        </div>
        <p className="mt-2 opacity-70">
          Five families of parallel lines, one per pentagon direction. Every crossing
          is one tile: a shallow 72° crossing makes a thick rhombus, a steep 144° one a
          thin rhombus. Each crossing is a square face of the 5D cube lattice, and the
          rhombus is its shadow. Hover a tile or a crossing and its partner lights up.
          Nothing is placed by hand, and every crossing in view becomes a tile.
        </p>
      </div>
    </Sketch>
  );
}
