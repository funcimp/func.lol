"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import { buildPatch, type SketchTile } from "./lib/cutProject";
import { buildEdgeWalk, DIRS, type EdgeWalk } from "./lib/address";

// "Every tile knows its address": the spine's section-8 sketch. The address is the
// tile's ℤ⁵ coordinate, five integers. Every edge of the tiling is a unit step in one
// of five fixed directions, so you can WALK to any tile along its edges. The reveal:
// first the blank route, tracing edge by edge from the origin tile to the target,
// with the tiles hidden. Then the tiling fades in around it, and because the route ran
// along real edges, it lines up exactly with the grid.
//
// Bound to address.ts (and address.test.ts): the route is a breadth-first path on the
// real edge graph of the cut-and-project patch; every segment is a genuine unit-edge
// in one of the five directions, and it ends on the target tile's vertex.
//
// Canvas: the harness drives render(t); t traces the route then fades in the tiling.

const VB_W = 620;
const VB_H = 540;
const PAD = 28;

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };
type Pt = readonly [number, number];

function makeFit(walk: EdgeWalk, patch: SketchTile[]) {
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  const note = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const t of patch) for (const [x, y] of t.physical) note(x, y);
  for (const [x, y] of walk.path) note(x, y);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY) / 2 + 0.4;
  const s = Math.min((VB_W - 2 * PAD) / (2 * half), (VB_H - 2 * PAD - 40) / (2 * half));
  return (p: Pt): [number, number] => [
    VB_W / 2 + (p[0] - cx) * s,
    VB_H / 2 + 18 - (p[1] - cy) * s, // room for the address row up top
  ];
}

function caption(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  ink: string,
  alpha: number,
) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ink;
  ctx.font = "11px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function arrowHead(ctx: CanvasRenderingContext2D, from: [number, number], to: [number, number], ink: string) {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const len = 9;
  ctx.save();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(to[0], to[1]);
  ctx.lineTo(to[0] - len * Math.cos(ang - 0.4), to[1] - len * Math.sin(ang - 0.4));
  ctx.lineTo(to[0] - len * Math.cos(ang + 0.4), to[1] - len * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paint(
  ctx: CanvasRenderingContext2D,
  t: number,
  walk: EdgeWalk,
  patch: SketchTile[],
  colors: Colors,
) {
  const { thick, thin, paper, ink } = colors;
  const fit = makeFit(walk, patch);
  const E = walk.edgeDirs.length;

  // Phase 1: trace the route along edges. Phase 2: the tiling fades in around it.
  const walkP = Math.max(0, Math.min(1, t / 0.58));
  const shown = Math.max(0, Math.min(E, Math.round(walkP * E)));
  const fade = Math.max(0, Math.min(1, (t - 0.62) / 0.38));

  ctx.clearRect(0, 0, VB_W, VB_H);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, VB_W, VB_H);

  // The surrounding tiling, faded in.
  if (fade > 0) {
    for (const tl of patch) {
      ctx.beginPath();
      tl.physical.forEach((c, i) => {
        const [x, y] = fit(c);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.save();
      ctx.globalAlpha = fade * 0.8;
      ctx.fillStyle = tl.type === "thick" ? thick : thin;
      ctx.fill();
      ctx.globalAlpha = fade * 0.5;
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = ink;
      ctx.stroke();
      ctx.restore();
    }
    // The target tile, highlighted where the route lands.
    ctx.beginPath();
    walk.targetCorners.forEach((c, i) => {
      const [x, y] = fit(c);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = walk.targetType === "thick" ? thick : thin;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.restore();
  }

  // The five direction rays from the start vertex: the edge directions the route uses.
  const o = fit(walk.start.p);
  const curDir = shown > 0 ? walk.edgeDirs[shown - 1] : -1;
  for (let l = 0; l < 5; l++) {
    const tipData: Pt = [walk.start.p[0] + DIRS[l][0], walk.start.p[1] + DIRS[l][1]];
    const tip = fit(tipData);
    const lit = l === curDir && fade < 0.5;
    ctx.save();
    ctx.globalAlpha = (lit ? 0.7 : 0.28) * (1 - fade * 0.7);
    ctx.strokeStyle = ink;
    ctx.lineWidth = lit ? 1.8 : 1;
    ctx.setLineDash(lit ? [] : [3, 3]);
    ctx.beginPath();
    ctx.moveTo(o[0], o[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    ctx.restore();
    caption(ctx, String(l), tip[0] + (tip[0] - o[0]) * 0.18, tip[1] + (tip[1] - o[1]) * 0.18, ink, 0.45 * (1 - fade * 0.6));
  }

  // The route: a bold ink polyline with a paper casing so it reads over the tiles.
  if (shown > 0) {
    for (const [w, col] of [[5.5, paper], [2.6, ink]] as const) {
      ctx.save();
      ctx.beginPath();
      const p0 = fit(walk.path[0]);
      ctx.moveTo(p0[0], p0[1]);
      for (let i = 1; i <= shown; i++) {
        const [x, y] = fit(walk.path[i]);
        ctx.lineTo(x, y);
      }
      ctx.lineWidth = w;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = col;
      ctx.stroke();
      ctx.restore();
    }
    arrowHead(ctx, fit(walk.path[shown - 1]), fit(walk.path[shown]), ink);
    for (let i = 1; i <= shown; i++) {
      const [x, y] = fit(walk.path[i]);
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = ink;
      ctx.fill();
    }
  }

  // Start marker.
  ctx.beginPath();
  ctx.arc(o[0], o[1], 3.4, 0, Math.PI * 2);
  ctx.fillStyle = ink;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(o[0], o[1], 3.4, 0, Math.PI * 2);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = paper;
  ctx.stroke();
  caption(ctx, "start", o[0], o[1] + 15, ink, 0.5 * (1 - fade * 0.4));

  // The address row, up top: the target tile's coordinate, lit once the route lands.
  const addrAlpha = shown >= E ? 0.95 : 0.4;
  ctx.save();
  ctx.font = "15px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  caption(ctx, "ADDRESS", VB_W / 2, 14, ink, 0.5);
  const digitGap = 30;
  const startX = VB_W / 2 - (digitGap * 4) / 2;
  for (let l = 0; l < 5; l++) {
    ctx.globalAlpha = addrAlpha;
    ctx.fillStyle = ink;
    ctx.fillText(String(walk.targetCoord[l]), startX + l * digitGap, 34);
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // Bottom caption.
  if (fade > 0.2) {
    caption(ctx, "the route ran along real edges, so it lines up with the grid", VB_W / 2, VB_H - 14, ink, fade * 0.8);
  } else {
    caption(ctx, "walk along the edges to the tile, each edge one of five directions", VB_W / 2, VB_H - 14, ink, 0.72);
  }
}

export default function AddressWalk() {
  const walk = useMemo(() => buildEdgeWalk(), []);
  const patch = useMemo(() => buildPatch(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({
    thick: "#C89B3C",
    thin: "#3E6B7C",
    paper: "#0f0e0c",
    ink: "#ede9d8",
  });
  const dprRef = useRef(0);

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
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      if (dpr !== dprRef.current) {
        dprRef.current = dpr;
        canvas.width = VB_W * dpr;
        canvas.height = VB_H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        refreshColors();
      }
      paint(ctx, t, walk, patch, colorsRef.current);
    },
    [refreshColors, walk, patch],
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      refreshColors();
      render(1);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [refreshColors, render]);

  const addr = walk.targetCoord.join(", ");

  return (
    <Sketch
      label="sketch 08 · every tile knows its address"
      animation={{ duration: 6500, render, slider: { label: "walk" } }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "auto",
          aspectRatio: `${VB_W} / ${VB_H}`,
        }}
        className="block w-full bg-paper"
        role="img"
        aria-label={`Every Penrose tile has a five-integer address, its coordinate. The tiling's edges all run in one of five fixed directions, drawn as labeled rays from the start vertex. The animation traces a route from the start tile to a target tile, edge by edge along those directions, with the tiles hidden. Then the surrounding tiling fades in, and because the route ran along real tile edges it lines up exactly with the grid. The target tile's address is [${addr}], the same coordinate the explorer reads under your cursor.`}
      />
      <div className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5]">
        <p>
          Address <span className="font-mono">[{addr}]</span>. Every edge of the
          tiling runs in one of five fixed directions, so you can walk to any tile
          along its edges. Trace the route from the start tile and you arrive here,
          on the boundaries of the real tiles.
        </p>
        <p className="mt-2 opacity-70">
          Every tile gets five integers like this, an exact name on a floor with no
          edges. That is the coordinate the explorer reads under your cursor, and a
          shared link is just these five numbers.
        </p>
      </div>
    </Sketch>
  );
}
