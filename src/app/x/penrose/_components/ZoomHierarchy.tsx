"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Sketch from "./Sketch";
import { PHI, rhombiAt, type Pt, type Rhombus } from "./lib/scaling";

// "Zoom the hierarchy": the spine's section-9 sketch two, rebuilt as a real zoom-out
// where the lines become tiles. The camera sits deep inside one fixed deflated patch,
// showing fine tiles with their level-up SUPERTILES outlined over them. Zoom out (the
// slider, or play) and the supertile outlines shrink to the size the small tiles had
// and FILL IN, becoming the new tiles, while the next level up appears in outline.
// The tiling is self-similar, so this can go step after step.
//
// HONEST BY CONSTRUCTION. deflate(L) is subdivide(deflate(L-1)); every level is real
// engine output (lib/scaling.ts and its test), and the supertiles are the genuine
// level-up tiling rhombiAt(L-1), not hand-drawn. The zoom is a true camera scale; the
// level of detail crossfades as it crosses each phi-step, hidden by the dissolve.
// The camera stays well inside the wheel's rim, so no ragged edge is ever exposed,
// and only the tiles whose centroid lands in the frame are drawn (culled).
//
// Canvas: the harness drives render(t); t = 1 is zoomed in on the finest level (the
// rich reduced-motion frame), and lowering it zooms out, lines becoming tiles.

const VB = 480;
const MARGIN = 0;

// One fixed deep patch; the camera roams its interior. DEEP is the finest level
// drawn; the zoom walks DEEP down to DEEP - STEPS, each step a factor of phi.
const DEEP = 8;
const STEPS = 3;
const MIN_FILL = DEEP - STEPS; // 5
const FILL = 0.8;

// The camera. RHO0 is the view radius at the finest zoom; it grows by phi per step.
// VIEW_C is off the wheel centre (which is a five-fold star) so we see a generic
// patch, and is chosen with RHO0 so the view stays inside the unit-radius wheel.
const RHO0 = 0.11;
const VIEW_C: Pt = [0.22, 0.08];

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };
type Cell = { kind: "thick" | "thin"; corners: readonly Pt[]; cx: number; cy: number };

const smooth = (e0: number, e1: number, x: number): number => {
  const u = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return u * u * (3 - 2 * u);
};

function cellsAt(level: number): Cell[] {
  return rhombiAt(level).map((r: Rhombus) => {
    let cx = 0;
    let cy = 0;
    for (const [x, y] of r.corners) {
      cx += x;
      cy += y;
    }
    return { kind: r.kind, corners: r.corners, cx: cx / 4, cy: cy / 4 };
  });
}

type ToPx = (p: Pt) => [number, number];

function fillCells(
  ctx: CanvasRenderingContext2D,
  cells: Cell[],
  toPx: ToPx,
  cullR: number,
  colors: Colors,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  const { thick, thin, ink } = colors;
  ctx.save();
  ctx.lineJoin = "round";
  for (const r of cells) {
    if (Math.hypot(r.cx - VIEW_C[0], r.cy - VIEW_C[1]) > cullR) continue;
    ctx.beginPath();
    const [x0, y0] = toPx(r.corners[0]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < 4; i++) {
      const [x, y] = toPx(r.corners[i]);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = r.kind === "thick" ? thick : thin;
    ctx.fill();
    ctx.globalAlpha = alpha * 0.6;
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = ink;
    ctx.stroke();
  }
  ctx.restore();
}

function strokeCells(
  ctx: CanvasRenderingContext2D,
  cells: Cell[],
  toPx: ToPx,
  cullR: number,
  ink: string,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const r of cells) {
    if (Math.hypot(r.cx - VIEW_C[0], r.cy - VIEW_C[1]) > cullR) continue;
    const [x0, y0] = toPx(r.corners[0]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < 4; i++) {
      const [x, y] = toPx(r.corners[i]);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  ctx.stroke();
  ctx.restore();
}

export default function ZoomHierarchy() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({
    thick: "#C89B3C",
    thin: "#3E6B7C",
    paper: "#0f0e0c",
    ink: "#ede9d8",
  });
  const dprRef = useRef(0);

  // Precompute the levels the zoom touches (fill levels and their outline levels).
  const byLevel = useMemo<Record<number, Cell[]>>(() => {
    const out: Record<number, Cell[]> = {};
    for (let L = MIN_FILL - 2; L <= DEEP; L++) out[L] = cellsAt(L);
    return out;
  }, []);

  const [level, setLevel] = useState(DEEP);
  const levelRef = useRef(DEEP);
  const lastTRef = useRef(1);

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
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      if (dpr !== dprRef.current) {
        dprRef.current = dpr;
        canvas.width = VB * dpr;
        canvas.height = VB * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        refreshColors();
      }

      // t = 1: zoomed in on DEEP. Lowering t zooms out, one phi-step at a time.
      const u = (1 - t) * STEPS;
      const Lfill = DEEP - Math.floor(u);
      const frac = u - Math.floor(u);
      const fade = smooth(0.1, 0.9, frac);

      const rho = RHO0 * Math.pow(PHI, u);
      const c = (VB / 2 - MARGIN) / rho;
      const toPx: ToPx = (p) => [
        VB / 2 + (p[0] - VIEW_C[0]) * c,
        VB / 2 - (p[1] - VIEW_C[1]) * c,
      ];
      const cullR = rho * 1.45;
      const colors = colorsRef.current;

      ctx.clearRect(0, 0, VB, VB);
      ctx.fillStyle = colors.paper;
      ctx.fillRect(0, 0, VB, VB);

      // The fine tiles fading out, the level-up filling in to replace them.
      fillCells(ctx, byLevel[Lfill], toPx, cullR, colors, FILL * (1 - fade));
      if (byLevel[Lfill - 1]) fillCells(ctx, byLevel[Lfill - 1], toPx, cullR, colors, FILL * fade);

      // The supertile lines: the current supertiles fading as they fill, the next
      // level up appearing in outline to take their place.
      if (byLevel[Lfill - 1]) strokeCells(ctx, byLevel[Lfill - 1], toPx, cullR, colors.ink, 1 - fade);
      if (byLevel[Lfill - 2]) strokeCells(ctx, byLevel[Lfill - 2], toPx, cullR, colors.ink, fade);

      const shown = frac < 0.5 ? Lfill : Lfill - 1;
      if (shown !== levelRef.current) {
        levelRef.current = shown;
        setLevel(shown);
      }
    },
    [byLevel, refreshColors],
  );

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

  return (
    <Sketch
      label="sketch 09 · zoom the hierarchy"
      animation={{ duration: 9000, render, slider: { label: "zoom out" } }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "auto", aspectRatio: "1 / 1" }}
        className="block w-full bg-paper"
        role="img"
        aria-label="A real Penrose patch from the substitution engine, shown as a true zoom-out. The camera starts deep inside the tiling on the finest tiles, with their level-up supertiles drawn over them as bold ink outlines. Zooming out, the supertile outlines shrink to the size the small tiles had and fill in, becoming the new tiles, while the next level up appears in outline to take their place. The same two shapes recur at every scale, larger by the golden ratio each step, the tiling self-similar without end."
      />
      <div className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5]">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono">
          <span>
            <span className="opacity-55">level</span>{" "}
            <span className="font-bold">{level}</span>
          </span>
          <span aria-live="polite">
            <span className="opacity-55">tiles per supertile</span>{" "}
            <span className="font-bold">≈ {(PHI * PHI).toFixed(3)}</span>
          </span>
        </div>
        <p className="mt-2 opacity-70">
          The bold outlines are the real level-up tiles, the same two shapes φ ≈{" "}
          {PHI.toFixed(3)} times larger. Zoom out and they shrink into place and fill
          in: each holds φ² ≈ {(PHI * PHI).toFixed(3)} of the tiles a level down.
          Inflate or deflate forever and you stay on a valid Penrose tiling, a copy of
          itself at every scale.
        </p>
      </div>
    </Sketch>
  );
}
