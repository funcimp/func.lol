"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Sketch from "./Sketch";
import { PHI, rhombiAt, type Pt, type Rhombus } from "./lib/scaling";

// "Zoom the hierarchy": the spine's section-9 sketch two, a deflation zoom-in. The
// camera dives into one fixed deflated patch. The fade choreography the maintainer
// asked for, per step:
//   - colored tiles with their white supertile overlay
//   - the colors fade and the larger white overlay fades; the tiles themselves turn
//     into white outlines with nothing behind
//   - then finer colored tiles fade in underneath, and the cycle repeats one level
//     deeper.
// Each tile becomes the boundary of the finer tiles inside it: self-similarity made
// continuous, dived through five levels.
//
// HONEST BY CONSTRUCTION. deflate(L) is subdivide(deflate(L-1)); every level is real
// engine output (lib/scaling.ts and its test), so the white outline of one level is
// exactly the colored tiles of the level above. The zoom is a true camera scale; the
// level of detail crossfades as it crosses each phi-step, hidden by the dissolve. The
// camera stays well inside the wheel's rim, and tiles are culled by centroid so only
// the visible patch draws. (The geometry is finite: level 10 is already ~55k tiles, so
// the descent spans five real levels rather than literally sixteen.)
//
// Canvas: the harness drives render(t); t = 1 is the deepest zoom on the finest level
// (the rich reduced-motion frame); lowering t zooms back out.

const VB = 480;

// Levels drawn. The colored level walks MIN_C..MIN_C+STEPS as the camera zooms in;
// the white overlay is one level coarser, the finer tiles one level finer.
const MIN_C = 5;
const STEPS = 4; // colored 5 -> 9 across the zoom
const LO_LEVEL = MIN_C - 1; // 4 (coarsest white overlay)
const HI_LEVEL = MIN_C + STEPS + 1; // 10 (finest tiles that fade in)
const FILL = 0.8;

// The camera dives toward VIEW_C, off the central five-fold star, staying inside the
// unit-radius wheel. RHO_START is the view radius at the coarsest level; it shrinks by
// phi per step (zoom in).
const RHO_START = 0.32;
const VIEW_C: Pt = [0.32, 0.13];

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
    ctx.globalAlpha = alpha * 0.5;
    ctx.lineWidth = 0.6;
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

  const byLevel = useMemo<Record<number, Cell[]>>(() => {
    const out: Record<number, Cell[]> = {};
    for (let L = LO_LEVEL; L <= HI_LEVEL; L++) out[L] = cellsAt(L);
    return out;
  }, []);

  const [level, setLevel] = useState(MIN_C + STEPS);
  const levelRef = useRef(MIN_C + STEPS);
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

      // t = 1: deepest zoom on the finest level. Lowering t zooms out one step at a time.
      const u = t * STEPS;
      const Lc = MIN_C + Math.floor(u); // the colored level
      const frac = u - Math.floor(u);
      // Stage the fade: first the colors and larger overlay go and the tiles become a
      // white outline (nothing behind); then the finer tiles fade in underneath.
      const fadeA = smooth(0, 0.45, frac);
      const fadeB = smooth(0.45, 0.9, frac);

      const rho = RHO_START * Math.pow(PHI, -u);
      const c = (VB / 2) / rho;
      const toPx: ToPx = (p) => [
        VB / 2 + (p[0] - VIEW_C[0]) * c,
        VB / 2 - (p[1] - VIEW_C[1]) * c,
      ];
      const cullR = rho * 1.5;
      const colors = colorsRef.current;

      ctx.clearRect(0, 0, VB, VB);
      ctx.fillStyle = colors.paper;
      ctx.fillRect(0, 0, VB, VB);

      // finer colored tiles, fading in underneath
      if (byLevel[Lc + 1]) fillCells(ctx, byLevel[Lc + 1], toPx, cullR, colors, FILL * fadeB);
      // current colored tiles, fading out
      fillCells(ctx, byLevel[Lc], toPx, cullR, colors, FILL * (1 - fadeA));
      // the larger white overlay (supertiles), fading out
      if (byLevel[Lc - 1]) strokeCells(ctx, byLevel[Lc - 1], toPx, cullR, colors.ink, 1 - fadeA);
      // the current tiles becoming white outlines
      strokeCells(ctx, byLevel[Lc], toPx, cullR, colors.ink, fadeA);

      const shown = fadeB < 0.5 ? Lc : Lc + 1;
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
      animation={{ duration: 11000, render, slider: { label: "zoom in" } }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "auto", aspectRatio: "1 / 1" }}
        className="block w-full bg-paper"
        role="img"
        aria-label="A real Penrose patch from the substitution engine, shown as a deflation zoom-in. Colored tiles carry a white outline of their supertiles. Zooming in, the colors fade and the larger white overlay fades, the tiles themselves become white outlines with nothing behind, and finer colored tiles fade in underneath, each tile becoming the boundary of the finer tiles inside it. The same two shapes recur at every scale, smaller by the golden ratio each step, the tiling self-similar as the camera dives through five levels."
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
          Each tile becomes the outline of the finer tiles inside it, the same two
          shapes 1/φ ≈ {(1 / PHI).toFixed(3)} the size. Every supertile holds φ² ≈{" "}
          {(PHI * PHI).toFixed(3)} of them. Inflate or deflate forever and you stay on
          a valid Penrose tiling, a copy of itself at every scale.
        </p>
      </div>
    </Sketch>
  );
}
