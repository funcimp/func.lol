"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Sketch from "./Sketch";
import { halfExtent, PHI, rhombiAt, type Pt, type Rhombus } from "./lib/scaling";

// "Zoom the hierarchy": the spine's section-9 sketch two, rebuilt to show the
// transition BETWEEN layers, not snap between them. The choreography the slider
// walks: a filled pattern, the level-up supertiles outlined over it, then the
// supertiles fill in and BECOME the pattern while the next level up appears in
// outline. Scrub it and the tiling inflates one step at a time, each level
// dissolving into the next, the self-similarity made continuous.
//
// HONEST BY CONSTRUCTION. deflate(L) is subdivide(deflate(L-1)), so the supertiles
// are the genuine level-up tiling rhombiAt(L-1), not hand-drawn boundaries. Every
// layer is real engine output (lib/scaling.ts and its test). The crossfade is at a
// constant scale, so the wheel stays inscribed and the promotion of supertiles to
// tiles is exact: rhombiAt(L-1) outlined at the start of a step is rhombiAt(L-1)
// filled at its end.
//
// Note on the maintainer's "zoom out slightly" idea: a literal camera zoom-out would
// expose the finite wheel's ragged rim, so instead the tiles inflate in place (each
// level's tiles grow by phi into the next), which keeps the frame clean and shows the
// same relationship. A true infinite zoom would need a different, unbounded generator.
//
// Canvas: the harness drives render(t) and the slider scrubs the depth. t = 1 is the
// finest level (the rich reduced-motion frame); scrubbing down inflates it.

const VB = 480;
const MARGIN = 12;

// The levels walked. L is the small-tile level, L-1 its supertiles. MIN 2 so there is
// always a supertiling; MAX 6 so the finest tiles stay legible.
const MIN_LEVEL = 2;
const MAX_LEVEL = 6;
const FILL = 0.78; // pattern fill opacity; bold ink supertile outlines read over it

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };

// Smoothstep: hold the pure "pattern + supertile lines" state briefly at each end of
// a step, dissolve through the middle, so the inflation reads as a transition.
const smooth = (e0: number, e1: number, x: number): number => {
  const u = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return u * u * (3 - 2 * u);
};

type ToPx = (p: Pt) => [number, number];

function fillRhombi(
  ctx: CanvasRenderingContext2D,
  rhombi: readonly Rhombus[],
  toPx: ToPx,
  colors: Colors,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  const { thick, thin, ink } = colors;
  const edge = Math.max(0.25, Math.min(0.8, 14 / Math.sqrt(rhombi.length)));
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
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = ink;
    ctx.lineWidth = edge;
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }
  ctx.restore();
}

function strokeRhombi(
  ctx: CanvasRenderingContext2D,
  rhombi: readonly Rhombus[],
  toPx: ToPx,
  ink: string,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
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

  // Precompute each level's rhombi and one shared scale. All levels are the same wheel
  // at unit radius, so one half-extent frames every level and they stay registered.
  const byLevel = useMemo<Rhombus[][]>(
    () => Array.from({ length: MAX_LEVEL + 1 }, (_, l) => (l >= 1 ? rhombiAt(l) : [])),
    [],
  );
  const fitHalf = useMemo(() => {
    let h = 0;
    for (let l = MIN_LEVEL; l <= MAX_LEVEL; l++) h = Math.max(h, halfExtent(byLevel[l]));
    return h;
  }, [byLevel]);

  const [level, setLevel] = useState(MAX_LEVEL);
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
        canvas.height = VB * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        refreshColors();
      }

      // t = 1 is the finest level; lowering it inflates the tiling one step at a time.
      const span = MAX_LEVEL - MIN_LEVEL;
      const p = (1 - t) * span;
      const Lf = MAX_LEVEL - Math.floor(p);
      const frac = p - Math.floor(p);
      const fade = smooth(0.18, 0.82, frac);

      const s = (VB - 2 * MARGIN) / (2 * fitHalf);
      const toPx: ToPx = (q) => [VB / 2 + q[0] * s, VB / 2 - q[1] * s];
      const colors = colorsRef.current;

      ctx.clearRect(0, 0, VB, VB);
      ctx.fillStyle = colors.paper;
      ctx.fillRect(0, 0, VB, VB);

      // The pattern: the fine level fading out, the level-up filling in to replace it.
      fillRhombi(ctx, byLevel[Lf], toPx, colors, FILL * (1 - fade));
      if (Lf - 1 >= 1) fillRhombi(ctx, byLevel[Lf - 1], toPx, colors, FILL * fade);

      // The supertile lines: the current supertiles fading as they fill in, and the
      // next level up appearing in outline to take their place.
      if (Lf - 1 >= 1) strokeRhombi(ctx, byLevel[Lf - 1], toPx, colors.ink, 1 - fade);
      if (Lf - 2 >= 1) strokeRhombi(ctx, byLevel[Lf - 2], toPx, colors.ink, fade);

      const shown = frac < 0.5 ? Lf : Lf - 1;
      if (shown !== levelRef.current) {
        levelRef.current = shown;
        setLevel(shown);
      }
    },
    [byLevel, fitHalf, refreshColors],
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

  const smallN = byLevel[level]?.length ?? 0;
  const superN = level - 1 >= 1 ? byLevel[level - 1].length : 0;

  return (
    <Sketch
      label="sketch 09 · zoom the hierarchy"
      animation={{ duration: 7000, render, slider: { label: "depth" } }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "auto", aspectRatio: "1 / 1" }}
        className="block w-full bg-paper"
        role="img"
        aria-label="A real Penrose patch from the substitution engine, shown as an inflation that you scrub. At each step a filled pattern of rhombi has the genuine level-up tiling, the supertiles it composes into, drawn over it as bold ink outlines. Moving the slider dissolves the small tiles into those supertiles: the outlines fill in and become the new pattern, while the next level up appears in outline to take their place. The same two shapes recur at every scale, larger by the golden ratio each step, the tiling self-similar without end."
      />
      <div className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5]">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono">
          <span>
            <span className="opacity-55">depth</span>{" "}
            <span className="font-bold">{level}</span>
          </span>
          <span aria-live="polite">
            <span className="opacity-55">small tiles</span>{" "}
            <span className="font-bold">{smallN.toLocaleString()}</span>
          </span>
          <span>
            <span className="opacity-55">supertiles</span>{" "}
            <span className="font-bold">{superN.toLocaleString()}</span>
          </span>
          <span>
            <span className="opacity-55">small ÷ super</span>{" "}
            <span className="font-bold">{superN ? (smallN / superN).toFixed(3) : "—"}</span>
          </span>
        </div>
        <p className="mt-2 opacity-70">
          The bold outlines are the real level-up tiles, the same two shapes φ ≈{" "}
          {PHI.toFixed(3)} times larger. Each holds φ² ≈ {(PHI * PHI).toFixed(3)} times
          as many small tiles a level down. Scrub the depth and watch a level dissolve
          into the next: inflate or deflate forever and you stay on a valid Penrose
          tiling, a copy of itself at every scale.
        </p>
      </div>
    </Sketch>
  );
}
