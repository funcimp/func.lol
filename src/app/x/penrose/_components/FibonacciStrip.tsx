"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import {
  D,
  DPERP,
  latticePoints,
  LONG,
  physical,
  SHORT,
  WINDOW_W,
} from "./lib/fibonacci";
import { facesInViewport, GAMMA } from "../explore/lib/pentagrid";
import type { RenderFace } from "../explore/lib/patch";

// "Cut and project, where you can see it": the spine's section-6 lead-in. The same
// construction one dimension lower, fully visible. A square integer lattice, a line at
// the golden slope, and a strip (the window) around it. A scan sweeps ALONG the line:
// the points it crosses inside the strip drop onto the line and grow the Fibonacci
// chain, long and short intervals, ratio phi, never repeating. Below, the real 2D
// Penrose tiling, the same cut and project one stage up (5D -> 2D), builds in the same
// sweep, and a pointer tracks from the scan's point on the line to the tile filling in
// at that moment. Cut is the strip, project is the drop, and the same method one stage
// up gives the tiles on the grid.
//
// Bound to fibonacci.ts (and fibonacci.test.ts): every accepted point and every
// long/short gap is computed, not drawn by hand. The Penrose patch is real enumerator
// output (facesInViewport). The pointer is an analogy in step (both quasicrystals have
// two prototiles, built by the same window test), not a tile-by-tile map across the
// dimensions.
//
// Canvas: the harness drives render(t); t is the scan position. Theme colours are read
// live. Reduced motion mounts at t = 1, the finished frame (scan and pointer gone).

const VB_W = 720;
const VB_H = 712;
const PAD = 30;

const TOP = { x: PAD, y: 26, w: VB_W - 2 * PAD, h: 214 };
const CHAIN_Y = 288;
const CHAIN_H = 16;
const PEN = { x: PAD, y: 350, w: VB_W - 2 * PAD, h: 330 };

// How much of the lattice to show. The line of slope 1/phi runs across this box.
const VIEW_M = 7;
const VIEW_N = 5;
const S_EXT = 16; // half-length of the drawn line/strip in data units (overshoots view)
const OFFSET0 = 0.05; // the fixed window offset (centres the strip on the line)

// The Penrose patch: the same cut and project, one stage up.
const PEN_PX = 8.5; // physical half-width shown
const PEN_PY = (PEN_PX * PEN.h) / PEN.w; // matched to the panel aspect
const PEN_SCALE = Math.min(PEN.w / (2 * PEN_PX), PEN.h / (2 * PEN_PY));
const PEN_VIEW = {
  minX: -PEN_PX - 0.8,
  maxX: PEN_PX + 0.8,
  minY: -PEN_PY - 0.8,
  maxY: PEN_PY + 0.8,
};

type V2 = readonly [number, number];
const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const scale = (k: number, v: V2): V2 => [k * v[0], k * v[1]];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// A tile plus its projection onto the line direction, so the plane can be swept in the
// same direction as the line scan above it.
type Cell2D = { f: RenderFace; proj: number };

const penToPx = ([x, y]: V2): [number, number] => [
  PEN.x + PEN.w / 2 + x * PEN_SCALE,
  PEN.y + PEN.h / 2 - y * PEN_SCALE,
];

// Data (m,n) plane -> pixels, equal scale so the lattice stays square, y flipped.
const SCALE = Math.min(TOP.w / (2 * VIEW_M), TOP.h / (2 * VIEW_N));
const fitD = ([x, y]: V2): [number, number] => [
  TOP.x + TOP.w / 2 + x * SCALE,
  TOP.y + TOP.h / 2 - y * SCALE,
];

// A point on the line internal = k, at parameter s along the line direction D.
const onLine = (k: number, s: number): V2 => add(scale(k, DPERP), scale(s, D));

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };

function caption(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  ink: string,
  alpha: number,
  align: CanvasTextAlign = "center",
) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ink;
  ctx.font =
    "11px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function arrowHead(
  ctx: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  color: string,
  alpha: number,
) {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const len = 9;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
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
  colors: Colors,
  cells: Cell2D[],
) {
  const { thick, thin, paper, ink } = colors;
  const gamma = OFFSET0 - WINDOW_W / 2; // centre the window on the line

  ctx.clearRect(0, 0, VB_W, VB_H);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, VB_W, VB_H);

  caption(ctx, "THE LATTICE, A LINE, A STRIP", TOP.x, 16, ink, 0.55, "left");
  caption(ctx, "scan the strip across the grid ▸", VB_W - PAD, 16, ink, 0.5, "right");

  const all = latticePoints(VIEW_M + 1, gamma).filter(
    (p) => Math.abs(p.m) <= VIEW_M && Math.abs(p.n) <= VIEW_N,
  );
  const accepted = all
    .filter((p) => p.accepted)
    .sort((a, b) => a.phys - b.phys);
  const physMin = accepted.length ? accepted[0].phys : -1;
  const physMax = accepted.length ? accepted[accepted.length - 1].phys : 1;

  // The scan: a position that sweeps ALONG the line, from one end of the view to the
  // other, as t goes 0 -> 1. Points are revealed as the scan crosses them (directional,
  // not from the centre), so the strip genuinely traverses the grid.
  const SW0 = physMin - 1;
  const SW1 = physMax + 1;
  const sweep = SW0 + t * (SW1 - SW0);
  const BAND = 0.7;
  const reveal1 = (phys: number) => clamp01((sweep - phys) / BAND);
  // The scan head and the pointer fade out at the very end for a clean finished frame.
  const scanFade = 1 - clamp01((t - 0.92) / 0.08);

  // The plane is swept in the same direction (projection onto D), so the two build in
  // step and the pointer connects their two fronts.
  let projMin = Infinity;
  let projMax = -Infinity;
  for (const c of cells) {
    if (c.proj < projMin) projMin = c.proj;
    if (c.proj > projMax) projMax = c.proj;
  }
  const sweep2 = projMin - 1 + t * (projMax - projMin + 2);
  const reveal2 = (proj: number) => clamp01((sweep2 - proj) / 0.9);

  // --- top lattice panel, clipped --------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.rect(TOP.x, TOP.y, TOP.w, TOP.h);
  ctx.clip();

  // The strip (the window) and the line, the fixed apparatus the scan runs along.
  const strip: V2[] = [
    onLine(gamma, -S_EXT),
    onLine(gamma, S_EXT),
    onLine(gamma + WINDOW_W, S_EXT),
    onLine(gamma + WINDOW_W, -S_EXT),
  ];
  ctx.beginPath();
  strip.forEach((p, i) => {
    const [px, py] = fitD(p);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.08;
  ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  const [l0x, l0y] = fitD(onLine(0, -S_EXT));
  const [l1x, l1y] = fitD(onLine(0, S_EXT));
  ctx.beginPath();
  ctx.moveTo(l0x, l0y);
  ctx.lineTo(l1x, l1y);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Lattice points the scan has crossed: rejected faint, accepted dropped onto the line.
  for (const p of all) {
    if (p.accepted) continue;
    const ap = reveal1(p.phys);
    if (ap <= 0.01) continue;
    const [px, py] = fitD([p.m, p.n]);
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.22 * ap;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const p of accepted) {
    const ap = reveal1(p.phys);
    if (ap <= 0.01) continue;
    const foot = scale(physical(p.m, p.n), D);
    const [pxx, pyy] = fitD([p.m, p.n]);
    const [fxx, fyy] = fitD(foot);
    ctx.beginPath();
    ctx.moveTo(pxx, pyy);
    ctx.lineTo(fxx, fyy);
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.4 * ap;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of accepted) {
    const ap = reveal1(p.phys);
    if (ap <= 0.01) continue;
    const [px, py] = fitD([p.m, p.n]);
    ctx.globalAlpha = ap;
    ctx.beginPath();
    ctx.arc(px, py, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, 3.4, 0, Math.PI * 2);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = paper;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // The scan head: a bright line perpendicular to the strip at the sweep position,
  // travelling along the diagonal.
  if (scanFade > 0.01 && sweep > SW0 && sweep < SW1) {
    const a = add(scale(sweep, D), scale(gamma - 0.5, DPERP));
    const b = add(scale(sweep, D), scale(gamma + WINDOW_W + 0.5, DPERP));
    const [ax, ay] = fitD(a);
    const [bx, by] = fitD(b);
    ctx.save();
    ctx.globalAlpha = scanFade;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore(); // end clip

  // --- the 1D chain bar ------------------------------------------------------
  const x0 = PAD + 8;
  const x1 = VB_W - PAD - 8;
  const barX = (phys: number) =>
    x0 + ((phys - physMin) / (physMax - physMin || 1)) * (x1 - x0);
  if (accepted.length >= 2) {
    const mid = (LONG + SHORT) / 2;
    for (const p of accepted) {
      const ap = reveal1(p.phys);
      if (ap <= 0.01) continue;
      const foot = scale(physical(p.m, p.n), D);
      const [, fy] = fitD(foot);
      const bx = barX(p.phys);
      ctx.beginPath();
      ctx.moveTo(fitD(foot)[0], fy);
      ctx.lineTo(bx, CHAIN_Y - CHAIN_H / 2 - 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.12 * ap;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 1; i < accepted.length; i++) {
      if (accepted[i].phys > sweep) continue; // a gap shows once the scan has passed it
      const gap = accepted[i].phys - accepted[i - 1].phys;
      const isLong = gap > mid;
      const xa = barX(accepted[i - 1].phys);
      const xb = barX(accepted[i].phys);
      ctx.fillStyle = isLong ? thick : thin;
      ctx.fillRect(xa, CHAIN_Y - CHAIN_H / 2, xb - xa - 1.5, CHAIN_H);
    }
    for (const p of accepted) {
      const ap = reveal1(p.phys);
      if (ap <= 0.01) continue;
      const bx = barX(p.phys);
      ctx.beginPath();
      ctx.moveTo(bx, CHAIN_Y - CHAIN_H / 2 - 3);
      ctx.lineTo(bx, CHAIN_Y + CHAIN_H / 2 + 3);
      ctx.lineWidth = 1;
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.5 * ap;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    caption(
      ctx,
      "the chain on the line: long and short, ratio φ, never repeating",
      VB_W / 2,
      CHAIN_Y + CHAIN_H / 2 + 22,
      ink,
      0.78,
    );
  }

  caption(
    ctx,
    "points inside the strip drop onto the line as the scan passes",
    VB_W / 2,
    TOP.y + TOP.h + 16,
    ink,
    0.7,
  );

  // --- the real Penrose tiling, the same method one stage up, swept in step --------
  caption(
    ctx,
    "THE SAME METHOD, ONE STAGE UP · 5D → 2D · REAL PENROSE TILES",
    PEN.x,
    PEN.y - 14,
    ink,
    0.55,
    "left",
  );
  ctx.save();
  ctx.beginPath();
  ctx.rect(PEN.x, PEN.y, PEN.w, PEN.h);
  ctx.clip();
  ctx.lineJoin = "round";
  for (const { f, proj } of cells) {
    const appear = reveal2(proj);
    if (appear <= 0.01) continue;
    ctx.beginPath();
    f.corners.forEach((c, i) => {
      const [px, py] = penToPx([c[0], c[1]]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.globalAlpha = appear * 0.9;
    ctx.fillStyle = f.type === "thick" ? thick : thin;
    ctx.fill();
    ctx.globalAlpha = appear * 0.5;
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = ink;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // --- the pointer: from the scan's point on the line to the tile filling in now ----
  if (scanFade > 0.02 && accepted.length >= 2) {
    let frontier: (typeof accepted)[number] | null = null;
    for (const p of accepted) {
      if (p.phys <= sweep) frontier = p; // sorted ascending, so the last one passed
    }
    let ftile: RenderFace | null = null;
    let fbest = -Infinity;
    for (const { f, proj } of cells) {
      if (proj <= sweep2 && proj > fbest) {
        fbest = proj;
        ftile = f;
      }
    }
    if (frontier && ftile) {
      const fromX = barX(frontier.phys);
      const fromY = CHAIN_Y + CHAIN_H / 2 + 4;
      const to = penToPx(ftile.centroid);
      const color = ftile.type === "thick" ? thick : thin;
      ctx.save();
      ctx.globalAlpha = scanFade * 0.85;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(to[0], to[1]);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(fromX, fromY, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      arrowHead(ctx, [fromX, fromY], to, color, scanFade * 0.9);
    }
  }

  caption(
    ctx,
    "as the scan crosses the grid, the line and the plane fill in step",
    VB_W / 2,
    PEN.y + PEN.h + 18,
    ink,
    0.72,
  );
}

export default function FibonacciStrip() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({
    thick: "#C89B3C",
    thin: "#3E6B7C",
    paper: "#0f0e0c",
    ink: "#ede9d8",
  });
  const dprRef = useRef(0);

  // Precompute the fixed Penrose patch once, each tile tagged with its projection onto
  // the line direction so the plane can be swept in step with the scan.
  const cells = useMemo<Cell2D[]>(
    () =>
      facesInViewport(PEN_VIEW, GAMMA).map((f) => ({
        f,
        proj: f.centroid[0] * D[0] + f.centroid[1] * D[1],
      })),
    [],
  );

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
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      if (dpr !== dprRef.current) {
        dprRef.current = dpr;
        canvas.width = VB_W * dpr;
        canvas.height = VB_H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        refreshColors();
      }
      paint(ctx, t, colorsRef.current, cells);
    },
    [refreshColors, cells],
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

  const accepted = latticePoints(VIEW_M + 1, OFFSET0 - WINDOW_W / 2).filter(
    (p) => p.accepted && Math.abs(p.m) <= VIEW_M && Math.abs(p.n) <= VIEW_N,
  ).length;

  return (
    <Sketch
      label="sketch 04 · cut and project, in a dimension you can see"
      animation={{ duration: 9000, render, slider: { label: "scan" } }}
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
        aria-label={`The cut-and-project method shown one dimension down, fully visible. A square integer lattice, a straight line through the origin at the golden slope, and a strip of one-cell width around it forming the acceptance window. A scan line sweeps along the strip; the ${accepted} lattice points it crosses inside the strip drop a perpendicular onto the line, and those feet, laid flat below, form the Fibonacci chain of long and short intervals whose lengths are in ratio phi and whose order never repeats. Below is a real two-dimensional Penrose tiling produced by the same cut and project one stage up, from five dimensions to two; it fills in the same sweep, and a pointer tracks from the scan's point on the line to the tile filling in at that moment. The line and the plane build in step, the same method one dimension apart.`}
      />
    </Sketch>
  );
}
