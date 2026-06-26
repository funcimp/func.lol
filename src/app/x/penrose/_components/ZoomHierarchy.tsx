"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Sketch from "./Sketch";
import { PHI, rhombiAt, type Pt, type Rhombus } from "./lib/scaling";

// "Zoom the hierarchy": the spine's section-9 sketch two, a deflation zoom-in drawn
// as NESTED LINE GRIDS in alternating colours. Each deflation level is the tiling's
// edges drawn in one colour; consecutive levels alternate gold and blue, so as the
// camera dives the nesting stays legible: a gold grid with a finer blue grid inside
// it, then blue prominent with a finer gold grid inside, level after level. The
// current level is brightest, its coarser and finer neighbours fainter, with a gentle
// crossfade as the camera passes each phi-step (no heavy fade to lose the nesting in).
//
// HONEST BY CONSTRUCTION. deflate(L) is subdivide(deflate(L-1)); every level is real
// engine output (lib/scaling.ts and its test), so the finer grid inside a tile is
// exactly that tile's subdivision. The zoom is a true camera scale; the camera stays
// inside the wheel's rim, and tiles are culled by centroid so only the visible patch
// draws. (The geometry is finite: level 10 is already ~55k tiles, so the dive spans
// five real levels.)
//
// Canvas: the harness drives render(t); t = 1 is the deepest zoom on the finest level;
// lowering t zooms back out.

const VB = 480;

// Levels drawn. The current level walks MIN_C..MIN_C+STEPS as the camera zooms in.
const MIN_C = 5;
const STEPS = 4;
const LO_LEVEL = MIN_C; // 5 (coarsest base)
const HI_LEVEL = MIN_C + STEPS; // 9 (finest layer drawn out)
// Each level gets a four-phase beat over its share of the timeline. The camera holds
// still through phases 1-3 and only zooms in phase 4.
//   [0, P1)   the layer alone (a breath)
//   [P1, P2)  the finer layer draws out across the plane, no zoom
//   [P2, P3)  both layers held, to let the nesting sink in
//   [P3, 1]   zoom in so the finer layer reaches the base size, the base fading out
const P1 = 0.2;
const P2 = 0.5;
const P3 = 0.68;

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
type Cell = { corners: readonly Pt[]; cx: number; cy: number };

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
    return { corners: r.corners, cx: cx / 4, cy: cy / 4 };
  });
}

type ToPx = (p: Pt) => [number, number];

// Even levels gold, odd levels blue, so consecutive (nested) levels always contrast.
const colorForLevel = (level: number, colors: Colors) =>
  level % 2 === 0 ? colors.thick : colors.thin;

// Stroke a level's edges. revealR + band let a layer "draw out" from the centre: a
// tile fades in as the wavefront radius passes its centroid. Pass a revealR past the
// cull radius (band 0) to draw the whole layer at once.
function strokeLevel(
  ctx: CanvasRenderingContext2D,
  cells: Cell[],
  toPx: ToPx,
  cullR: number,
  color: string,
  width: number,
  alpha: number,
  revealR: number,
  band: number,
) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  for (const r of cells) {
    const rad = Math.hypot(r.cx - VIEW_C[0], r.cy - VIEW_C[1]);
    if (rad > cullR) continue;
    let a = alpha;
    if (band > 0) a *= Math.max(0, Math.min(1, (revealR - rad) / band));
    if (a <= 0.01) continue;
    ctx.globalAlpha = a;
    ctx.beginPath();
    const [x0, y0] = toPx(r.corners[0]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < 4; i++) {
      const [x, y] = toPx(r.corners[i]);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
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

      // t = 1: deepest zoom on the finest level. Each level cycle: hold it alone, draw
      // out the finer layer, beat, then zoom so the finer layer becomes the new base.
      const seg = t * STEPS;
      const k = Math.min(STEPS - 1, Math.floor(seg));
      const g = seg - k; // progress through this level's beat
      const baseL = MIN_C + k;
      const finerL = baseL + 1;

      const drawOut = smooth(P1, P2, g); // the finer layer draws out in phase 2
      const zoomFrac = smooth(P3, 1, g); // the camera zooms only in phase 4
      const uZoom = k + zoomFrac; // holds through phases 1-3, then dives one level
      const rho = RHO_START * Math.pow(PHI, -uZoom);
      const c = VB / 2 / rho;
      const toPx: ToPx = (p) => [
        VB / 2 + (p[0] - VIEW_C[0]) * c,
        VB / 2 - (p[1] - VIEW_C[1]) * c,
      ];
      const cullR = rho * 1.6;
      const colors = colorsRef.current;

      ctx.clearRect(0, 0, VB, VB);
      ctx.fillStyle = colors.paper;
      ctx.fillRect(0, 0, VB, VB);

      // Base layer: full through the beats and the draw-out, fading as the zoom hands
      // the plane over to the finer layer.
      const baseAlpha = 0.92 * (1 - zoomFrac);
      if (byLevel[baseL]) {
        strokeLevel(ctx, byLevel[baseL], toPx, cullR, colorForLevel(baseL, colors), 1.7, baseAlpha, cullR + 1, 0);
      }
      // Finer layer: absent in phase 1, drawing out across the plane in phase 2, full
      // from then on (and growing to the base size through the zoom).
      if (byLevel[finerL] && drawOut > 0.001) {
        const full = g >= P2;
        const revealR = full ? cullR + 1 : drawOut * cullR;
        const band = full ? 0 : cullR * 0.28;
        strokeLevel(ctx, byLevel[finerL], toPx, cullR, colorForLevel(finerL, colors), 1.7, 0.92, revealR, band);
      }

      const shown = zoomFrac < 0.5 ? baseL : finerL;
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
      animation={{ duration: 20000, render, slider: { label: "zoom in" } }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "auto", aspectRatio: "1 / 1" }}
        className="block w-full bg-paper"
        role="img"
        aria-label="A real Penrose patch from the substitution engine, shown as a deflation zoom-in drawn as nested line grids. Each deflation level is the tiling's edges in one colour, and consecutive levels alternate gold and blue, so the nesting stays clear: a gold grid with a finer blue grid inside it, then blue prominent with a finer gold grid inside, level after level. Zooming in dives through five levels; each tile is subdivided into the same two shapes 1/phi the size. The current level is brightest, its neighbours fainter, the tiling self-similar at every scale."
      />
      <div className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5]">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono">
          <span>
            <span className="opacity-55">level</span>{" "}
            <span className="font-bold">{level}</span>
          </span>
          <span>
            <span className="opacity-55">each level</span>{" "}
            <span className="font-bold">alternates gold / blue</span>
          </span>
          <span aria-live="polite">
            <span className="opacity-55">tiles per supertile</span>{" "}
            <span className="font-bold">≈ {(PHI * PHI).toFixed(3)}</span>
          </span>
        </div>
        <p className="mt-2 opacity-70">
          Each grid is one deflation level, the next 1/φ ≈ {(1 / PHI).toFixed(3)} the
          size nested inside it, drawn in the opposite colour so the layers stay
          distinct. Every supertile holds φ² ≈ {(PHI * PHI).toFixed(3)} of the tiles a
          level down. Inflate or deflate forever and you stay on a valid Penrose
          tiling, a copy of itself at every scale.
        </p>
      </div>
    </Sketch>
  );
}
