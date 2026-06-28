"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Sketch from "./Sketch";
import {
  countSeries,
  halfExtent,
  PHI,
  rhombiAt,
  type Counts,
  type Pt,
  type Rhombus,
} from "./lib/scaling";

// "The golden ratio appears": the spine's section-9 sketch one. Count the fat tiles
// and the thin tiles in a Penrose patch and lay them out as two stacks, gold for
// thick and blue for thin. Deflate deeper and the gold stack grows out to exactly φ
// times the blue stack: the ratio of the counts is the golden ratio. The patch above
// is the real tiling being counted; the stacks below settle on the φ mark as the
// level climbs.
//
// HONEST BY CONSTRUCTION. Counts and geometry are deflate() output (lib/scaling.ts
// and its test): the thick:thin numbers equal faces.ts substitutionFaces at every
// level, the stack lengths are in exact thick:thin proportion, and the gap to φ
// shrinks as the level climbs.
//
// Canvas: the harness drives render(t); the slider scrubs the level (levels crossfade
// gradually). Theme colours are read live. Reduced motion mounts at t = 1, the
// deepest level, the gold stack on the φ mark.

const VB = 460;
const VB_H = 448;
const MARGIN = 12;

const MIN_LEVEL = 1;
const MAX_LEVEL = 8;

// The patch, centred in the top region.
const PATCH_CY = 138;
const PATCH_H = 268;

// The two stacks. Blue is the unit; gold runs blue * (thick/thin), reaching the φ
// mark at blue * φ. As the ratio climbs to φ the gold stack grows out to that mark.
const BAR_X0 = 80;
const BLUE_LEN = 188;
const GOLD_Y = 332;
const BLUE_Y = 374;
const BAR_H = 26;

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };

const smooth = (e0: number, e1: number, x: number): number => {
  const u = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return u * u * (3 - 2 * u);
};

// Draw one level's rhombi at a shared scale and a given opacity, centred in the patch
// region. No clear, so two adjacent levels can be composited into a crossfade frame.
function drawPatch(
  ctx: CanvasRenderingContext2D,
  rhombi: readonly Rhombus[],
  half: number,
  colors: Colors,
  alpha: number,
) {
  if (alpha <= 0.01 || rhombi.length === 0) return;
  const { thick, thin, ink } = colors;
  const s = (PATCH_H - 2 * MARGIN) / (2 * half);
  const toPx = (p: Pt): [number, number] => [VB / 2 + p[0] * s, PATCH_CY - p[1] * s];
  const edge = Math.max(0.3, Math.min(1, 18 / Math.sqrt(rhombi.length)));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = "round";
  for (const r of rhombi) {
    ctx.beginPath();
    const [x0, y0] = toPx(r.corners[0]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < 4; i++) {
      const [x, y] = toPx(r.corners[i]);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = r.kind === "thick" ? thick : thin;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = edge;
    ctx.stroke();
  }
  ctx.restore();
}

// A stack: a solid colour bar from x0 to x1, the count drawn as length.
function drawStack(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  y: number,
  color: string,
  ink: string,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(x0, y - BAR_H / 2, x1 - x0, BAR_H);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.strokeStyle = ink;
  ctx.strokeRect(x0, y - BAR_H / 2, x1 - x0, BAR_H);
  ctx.restore();
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  ink: string,
  alpha: number,
  align: CanvasTextAlign,
  size = 11,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ink;
  ctx.font = `${size}px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawStacks(ctx: CanvasRenderingContext2D, counts: Counts, colors: Colors) {
  const { thick, thin, ink } = colors;
  const ratio = counts.ratio;
  const eqX = BAR_X0 + BLUE_LEN; // where blue ends, and gold ends if the ratio were 1
  const phiX = BAR_X0 + BLUE_LEN * PHI; // the golden-ratio mark
  const goldX1 = BAR_X0 + BLUE_LEN * ratio;
  const yTop = GOLD_Y - BAR_H / 2 - 14;
  const yBot = BLUE_Y + BAR_H / 2 + 6;

  // the "x1" reference (ratio of one) and the golden mark
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(eqX, yTop);
  ctx.lineTo(eqX, yBot);
  ctx.stroke();
  ctx.restore();
  label(ctx, "×1", eqX, yBot + 12, ink, 0.45, "center");

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = thick;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(phiX, yTop - 6);
  ctx.lineTo(phiX, yBot);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  label(ctx, "× φ = 1.618", phiX, yTop - 14, thick, 0.95, "center");

  // the two stacks
  drawStack(ctx, BAR_X0, goldX1, GOLD_Y, thick, ink);
  drawStack(ctx, BAR_X0, eqX, BLUE_Y, thin, ink);

  // row labels and counts
  label(ctx, "thick", BAR_X0 - 10, GOLD_Y, ink, 0.7, "right");
  label(ctx, "thin", BAR_X0 - 10, BLUE_Y, ink, 0.7, "right");
  label(ctx, counts.thick.toLocaleString(), goldX1 + 8, GOLD_Y, ink, 0.85, "left");
  label(ctx, counts.thin.toLocaleString(), eqX + 8, BLUE_Y, ink, 0.85, "left");
}

export default function GoldenRatio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({
    thick: "#C89B3C",
    thin: "#3E6B7C",
    paper: "#0f0e0c",
    ink: "#ede9d8",
  });
  const dprRef = useRef(0);

  const series = useMemo<Counts[]>(() => countSeries(MAX_LEVEL), []);
  const patches = useMemo(
    () => Array.from({ length: MAX_LEVEL + 1 }, (_, l) => (l >= MIN_LEVEL ? rhombiAt(l) : [])),
    [],
  );
  const halves = useMemo(() => patches.map((rh) => (rh.length ? halfExtent(rh) : 1)), [patches]);

  const [counts, setCounts] = useState<Counts>(series[MAX_LEVEL - 1]);
  const levelRef = useRef(MAX_LEVEL);
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
        canvas.height = VB_H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        refreshColors();
      }

      const f = t * (MAX_LEVEL - MIN_LEVEL);
      const lo = MIN_LEVEL + Math.floor(f);
      const hi = Math.min(MAX_LEVEL, lo + 1);
      const frac = f - Math.floor(f);
      const fade = lo === hi ? 0 : smooth(0.05, 0.95, frac);
      const commonHalf = Math.max(halves[lo], halves[hi]);
      const shown = frac < 0.5 ? lo : hi;

      const colors = colorsRef.current;
      ctx.clearRect(0, 0, VB, VB_H);
      ctx.fillStyle = colors.paper;
      ctx.fillRect(0, 0, VB, VB_H);
      drawPatch(ctx, patches[lo], commonHalf, colors, 1 - fade);
      drawPatch(ctx, patches[hi], commonHalf, colors, fade);
      drawStacks(ctx, series[shown - 1], colors);

      if (shown !== levelRef.current) {
        levelRef.current = shown;
        setCounts(series[shown - 1]);
      }
    },
    [patches, halves, series, refreshColors],
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

  const gap = Math.abs(counts.ratio - PHI);

  return (
    <Sketch
      label="sketch 12 · the golden ratio appears"
      animation={{ duration: 7000, render, slider: { label: "level" } }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "auto", aspectRatio: `${VB} / ${VB_H}` }}
        className="block w-full bg-paper"
        role="img"
        aria-label="A real Penrose patch from the substitution engine at the chosen deflation level, in gold thick and teal thin rhombi. Below it, the count of thick tiles and thin tiles are laid out as two stacks of tile marks, gold and blue. The blue stack is the unit; the gold stack runs thick-to-thin times as long, reaching the golden-ratio mark at phi times the blue. As the level climbs the gold stack grows out to that mark: the ratio of fat to thin tiles is the golden ratio, about 1.618, the same ratio that set the tile angles."
      />
      <div className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5]">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono">
          <span>
            <span className="opacity-55">level</span>{" "}
            <span className="font-bold">{counts.level}</span>
          </span>
          <span>
            <span className="opacity-55">thick</span>{" "}
            <span className="font-bold">{counts.thick.toLocaleString()}</span>
          </span>
          <span>
            <span className="opacity-55">thin</span>{" "}
            <span className="font-bold">{counts.thin.toLocaleString()}</span>
          </span>
          <span aria-live="polite">
            <span className="opacity-55">thick ÷ thin</span>{" "}
            <span className="font-bold">{counts.ratio.toFixed(4)}</span>
          </span>
        </div>
        <p className="mt-2 opacity-70">
          Count the fat tiles and the thin ones and stack them. The gold stack runs φ ≈{" "}
          {PHI.toFixed(4)} times the blue, off by{" "}
          <span className="font-mono">{gap.toFixed(4)}</span> here. Deflate deeper and
          it lands on the golden ratio, the same φ that set the tile angles.
        </p>
      </div>
    </Sketch>
  );
}
