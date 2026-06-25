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

// "The golden ratio appears": the spine's section-9 sketch one. Step the slider
// through deflation levels. At each level the real patch is drawn (the rhombi the
// substitution engine emits) and the running fat:thin count and its ratio update.
// The ratio homes in on phi, the same golden ratio that set the tile angles.
//
// HONEST BY CONSTRUCTION. The counts and the geometry are both deflate() output
// (see lib/scaling.ts and its test): the thick:thin numbers equal faces.ts
// substitutionFaces at every level, and the ratio shown is exactly thick/thin. The
// gap to phi shrinks as the level climbs, which the colocated test pins.
//
// Canvas, like the other animated sketches: high levels are thousands of tiles, so
// the harness drives render(t) imperatively and the slider scrubs the level. The
// readout below is React state, updated from the same render, so it is a live
// region the count can be read from. Theme colours are read live, so the patch
// inverts with the toggle. Reduced motion is honored by the harness mounting at the
// representative end state (t = 1, the deepest level, ratio nearest phi).

const VB = 460;
const MARGIN = 12;

// The levels the slider walks. Capped at 8: deep enough that the ratio is within
// 0.01 of phi, shallow enough to draw every rhombus cleanly.
const MIN_LEVEL = 1;
const MAX_LEVEL = 8;

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };

// Smoothstep for crossfading between adjacent levels: hold each level steady across
// most of its slider segment and blend only through the middle, so a step reads as a
// dissolve, not a jolt.
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

export default function GoldenRatio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({
    thick: "#C89B3C",
    thin: "#3E6B7C",
    paper: "#0f0e0c",
    ink: "#ede9d8",
  });
  const dprRef = useRef(0);

  // Precompute every level's rhombi and counts once. Eight levels is a few thousand
  // tiles at most, cheap, and it makes scrubbing instant.
  const series = useMemo<Counts[]>(() => countSeries(MAX_LEVEL), []);
  const patches = useMemo(
    () => Array.from({ length: MAX_LEVEL + 1 }, (_, l) => (l >= MIN_LEVEL ? rhombiAt(l) : [])),
    [],
  );
  const halves = useMemo(() => patches.map((rh) => (rh.length ? halfExtent(rh) : 1)), [patches]);

  const [counts, setCounts] = useState<Counts>(series[MAX_LEVEL - 1]);
  const levelRef = useRef(MAX_LEVEL);

  const refreshColors = useCallback(() => {
    colorsRef.current = {
      thick: readVar("--color-penrose-thick", "#C89B3C"),
      thin: readVar("--color-penrose-thin", "#3E6B7C"),
      paper: readVar("--color-paper", "#0f0e0c"),
      ink: readVar("--color-ink", "#ede9d8"),
    };
  }, []);

  const lastTRef = useRef(1);

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

      // Continuous position in level space, the two bracketing levels, and a fade
      // that blends them only through the middle of each slider segment.
      const f = t * (MAX_LEVEL - MIN_LEVEL);
      const lo = MIN_LEVEL + Math.floor(f);
      const hi = Math.min(MAX_LEVEL, lo + 1);
      const frac = f - Math.floor(f);
      const fade = lo === hi ? 0 : smooth(0.35, 0.65, frac);
      const commonHalf = Math.max(halves[lo], halves[hi]);

      const colors = colorsRef.current;
      ctx.clearRect(0, 0, VB, VB);
      ctx.fillStyle = colors.paper;
      ctx.fillRect(0, 0, VB, VB);
      drawPatch(ctx, patches[lo], commonHalf, colors, 1 - fade);
      drawPatch(ctx, patches[hi], commonHalf, colors, fade);

      // The readout snaps to whichever level is the more present one.
      const shown = frac < 0.5 ? lo : hi;
      if (shown !== levelRef.current) {
        levelRef.current = shown;
        setCounts(series[shown - 1]);
      }
    },
    [patches, halves, refreshColors, series],
  );

  // Repaint on theme flip so the stationary frame inverts with the toggle.
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
        style={{ width: "100%", height: "auto", aspectRatio: "1 / 1" }}
        className="block w-full bg-paper"
        role="img"
        aria-label="A real Penrose patch from the substitution engine, drawn at the chosen deflation level in gold thick and teal thin rhombi. Stepping the level deeper subdivides every tile, and the running count of thick to thin tiles, shown below, homes in on the golden ratio phi, about 1.618, the same ratio that set the tile angles."
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
          Off φ ≈ {PHI.toFixed(4)} by{" "}
          <span className="font-mono">{gap.toFixed(4)}</span>. Step the level deeper
          and the gap keeps closing. Subdivide forever and the ratio of thick to
          thin tiles is exactly the golden ratio.
        </p>
      </div>
    </Sketch>
  );
}
