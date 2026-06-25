"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Sketch from "./Sketch";
import {
  halfExtent,
  hierarchyAt,
  PHI,
  type Hierarchy,
  type Pt,
  type Rhombus,
} from "./lib/scaling";

// "Zoom the hierarchy": the spine's section-9 sketch two. A real deflated patch is
// drawn small and filled, and over it the genuine level-up tiles (the supertiles
// the small tiles compose into) are drawn as ink outlines, at the same physical
// scale. Step the slider and the depth walks: more small tiles inside the same two
// supertile shapes, indefinitely. The point lands: any valid Penrose tiling
// inflates or deflates into another valid Penrose tiling scaled by phi, forever, so
// the pattern is self-similar across scales.
//
// HONEST BY CONSTRUCTION. deflate(L) is subdivide(deflate(L-1)), so the supertiles
// are not hand-drawn boundaries: they ARE deflate(L-1), the coarser valid tiling,
// at the same wheel radius. lib/scaling.ts produces both; the colocated test pins
// supers === rhombiAt(L-1) and the count growing by ~phi^2 per level.
//
// Canvas, like the other animated sketches: deeper levels are thousands of small
// tiles. The harness drives render(t) and the slider scrubs the depth. Theme
// colours are read live so it inverts with the toggle. Reduced motion is honored by
// the harness mounting at the representative end state (t = 1, the deepest depth,
// where the self-similarity reads hardest: many small tiles, the same big shapes).

const VB = 480;
const MARGIN = 12;

// The depths the slider walks. L is the small-tile level; L-1 is the supertile
// level. Start at 2 so there is always a supertiling to outline; cap at 6 so the
// small tiles stay visible inside their supertiles.
const MIN_LEVEL = 2;
const MAX_LEVEL = 6;

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };

const levelForT = (t: number): number =>
  Math.min(MAX_LEVEL, MIN_LEVEL + Math.round(t * (MAX_LEVEL - MIN_LEVEL)));

function polyPath(
  ctx: CanvasRenderingContext2D,
  r: Rhombus,
  toPx: (p: Pt) => [number, number],
) {
  ctx.beginPath();
  const [x0, y0] = toPx(r.corners[0]);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < 4; i++) {
    const [x, y] = toPx(r.corners[i]);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function paint(ctx: CanvasRenderingContext2D, h: Hierarchy, half: number, colors: Colors) {
  const { thick, thin, paper, ink } = colors;
  const s = (VB - 2 * MARGIN) / (2 * half);
  const toPx = (p: Pt): [number, number] => [VB / 2 + p[0] * s, VB / 2 - p[1] * s];

  ctx.clearRect(0, 0, VB, VB);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, VB, VB);
  ctx.lineJoin = "round";

  // The small tiles: the fine deflation, filled and muted so the supertile ink
  // reads over them. Hairline grout, thinner as they shrink.
  const edge = Math.max(0.25, Math.min(0.8, 14 / Math.sqrt(h.small.length)));
  for (const r of h.small) {
    polyPath(ctx, r, toPx);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = r.kind === "thick" ? thick : thin;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = edge;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // The supertiles: the genuine level-up tiling, drawn as bold ink outlines. These
  // are the same two shapes, phi times larger, that the small tiles group into.
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  for (const r of h.supers) {
    polyPath(ctx, r, toPx);
    ctx.stroke();
  }
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

  // Precompute every depth once. The supertiles of depth L are deflate(L-1) at the
  // same wheel radius, so small and supers fit on the same scale with no fudging.
  const depths = useMemo<Hierarchy[]>(
    () => Array.from({ length: MAX_LEVEL + 1 }, (_, l) => (l >= MIN_LEVEL ? hierarchyAt(l) : (null as unknown as Hierarchy))),
    [],
  );
  const halves = useMemo(
    () => depths.map((h) => (h ? halfExtent(h.small) : 1)),
    [depths],
  );

  const [level, setLevel] = useState(MAX_LEVEL);
  const levelRef = useRef(MAX_LEVEL);

  const refreshColors = useCallback(() => {
    colorsRef.current = {
      thick: readVar("--color-penrose-thick", "#C89B3C"),
      thin: readVar("--color-penrose-thin", "#3E6B7C"),
      paper: readVar("--color-paper", "#0f0e0c"),
      ink: readVar("--color-ink", "#ede9d8"),
    };
  }, []);

  const drawLevel = useCallback(
    (lvl: number) => {
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
      paint(ctx, depths[lvl], halves[lvl], colorsRef.current);
    },
    [depths, halves, refreshColors],
  );

  const render = useCallback(
    (t: number) => {
      const lvl = levelForT(t);
      drawLevel(lvl);
      if (lvl !== levelRef.current) {
        levelRef.current = lvl;
        setLevel(lvl);
      }
    },
    [drawLevel],
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      refreshColors();
      drawLevel(levelRef.current);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [refreshColors, drawLevel]);

  const h = depths[level];
  const smallN = h ? h.small.length : 0;
  const superN = h ? h.supers.length : 0;

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
        aria-label="A real Penrose patch from the substitution engine, drawn at two depths at once. The fine deflation is filled in muted gold and teal rhombi; over it the genuine level-up tiling, the supertiles the small rhombi compose into, is drawn as bold ink outlines, the same two shapes scaled up by the golden ratio. Stepping the depth deeper packs more small tiles inside the same big supertiles, the tiling self-similar across scales."
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
          as many small tiles a level down. Inflate or deflate forever and you land
          on another valid Penrose tiling, the pattern a copy of itself at every
          scale.
        </p>
      </div>
    </Sketch>
  );
}
