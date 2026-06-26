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

// "The golden ratio appears": the spine's section-9 sketch one. The question it
// answers: count the fat and thin rhombi in a Penrose patch, take their ratio, and
// what number is it? Deflate deeper and the ratio chases the golden ratio φ. The top
// panel is the real patch at the chosen level (the tiles being counted); the line
// below is a ruler with φ marked, and the ratio for each level is a dot on it. As the
// level climbs, the dot marches in on φ. That convergence IS the point.
//
// HONEST BY CONSTRUCTION. Counts and geometry are deflate() output (lib/scaling.ts
// and its test): the thick:thin numbers equal faces.ts substitutionFaces at every
// level, the ratio shown is exactly thick/thin, and the gap to φ shrinks as the level
// climbs. Nothing is hand-placed on the ruler.
//
// Canvas: the harness drives render(t); the slider scrubs the level (levels crossfade
// gradually). Theme colours are read live. Reduced motion mounts at t = 1, the
// deepest level, the dot sitting on φ.

const VB = 460; // the patch square
const VB_H = 560; // plus the convergence ruler below
const MARGIN = 12;

const MIN_LEVEL = 1;
const MAX_LEVEL = 8;

// The ruler. Ratios run 1.0 (low levels) up past φ; frame [0.95, 1.72] with φ inside.
const R_MIN = 0.95;
const R_MAX = 1.72;
const AX0 = 52;
const AX1 = VB - 46;
const AXIS_Y = 506;

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

// Draw one level's rhombi at a shared scale and a given opacity. No clear, so two
// adjacent levels can be composited into a single crossfade frame.
function drawPatch(
  ctx: CanvasRenderingContext2D,
  rhombi: readonly Rhombus[],
  half: number,
  colors: Colors,
  alpha: number,
) {
  if (alpha <= 0.01 || rhombi.length === 0) return;
  const { thick, thin, ink } = colors;
  const s = (VB - 2 * MARGIN) / (2 * half);
  const toPx = (p: Pt): [number, number] => [VB / 2 + p[0] * s, VB / 2 - p[1] * s];
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

const xForRatio = (r: number) =>
  AX0 + ((Math.max(R_MIN, Math.min(R_MAX, r)) - R_MIN) / (R_MAX - R_MIN)) * (AX1 - AX0);

// The convergence ruler: a line from 1 to ~1.72 with φ marked, one dot per level, the
// current level lit. The dots march in on φ as the level climbs.
function drawRuler(
  ctx: CanvasRenderingContext2D,
  series: Counts[],
  shown: number,
  colors: Colors,
) {
  const { thick, ink, paper } = colors;
  ctx.save();
  ctx.font = "11px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";
  ctx.textBaseline = "middle";

  // baseline
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(AX0, AXIS_Y);
  ctx.lineTo(AX1, AXIS_Y);
  ctx.stroke();

  // the φ mark
  const xphi = xForRatio(PHI);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = thick;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xphi, AXIS_Y - 34);
  ctx.lineTo(xphi, AXIS_Y + 8);
  ctx.stroke();
  ctx.fillStyle = thick;
  ctx.textAlign = "center";
  ctx.fillText("φ = 1.618", xphi, AXIS_Y - 44);

  // faint trend line through the level dots
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  series.forEach((c, i) => {
    const x = xForRatio(c.ratio);
    if (i === 0) ctx.moveTo(x, AXIS_Y);
    else ctx.lineTo(x, AXIS_Y);
  });
  ctx.stroke();

  // a dot per level; the current level lit and labelled
  for (const c of series) {
    const x = xForRatio(c.ratio);
    const cur = c.level === shown;
    ctx.globalAlpha = cur ? 1 : 0.4;
    ctx.beginPath();
    ctx.arc(x, AXIS_Y, cur ? 5 : 2.6, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
    if (cur) {
      ctx.beginPath();
      ctx.arc(x, AXIS_Y, 5, 0, Math.PI * 2);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = paper;
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.fillText(`level ${c.level}: ${c.ratio.toFixed(3)}`, x, AXIS_Y + 22);
    }
  }

  // end ticks
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ink;
  ctx.textAlign = "left";
  ctx.fillText("1.0", AX0 - 4, AXIS_Y + 22);
  ctx.restore();
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
      drawRuler(ctx, series, shown, colors);

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
      label="sketch 08 · the golden ratio appears"
      animation={{ duration: 7000, render, slider: { label: "level" } }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "auto", aspectRatio: `${VB} / ${VB_H}` }}
        className="block w-full bg-paper"
        role="img"
        aria-label="A real Penrose patch from the substitution engine at the chosen deflation level, in gold thick and teal thin rhombi. Below it is a ruler marked with the golden ratio phi at 1.618, and a dot for each level placed at that level's ratio of thick to thin tiles. As the level climbs, the dots march in on phi: the count ratio of fat to thin rhombi converges to the golden ratio, the same ratio that set the tile angles."
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
          Count the fat tiles and the thin tiles, and divide. Off φ ≈ {PHI.toFixed(4)}{" "}
          by <span className="font-mono">{gap.toFixed(4)}</span> here. Deflate deeper
          and the ratio keeps closing on the golden ratio, the same φ that set the tile
          angles in the first place.
        </p>
      </div>
    </Sketch>
  );
}
