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
  type LatPt,
} from "./lib/fibonacci";
import { facesInViewport, GAMMA } from "../explore/lib/pentagrid";
import type { RenderFace } from "../explore/lib/patch";

// "Cut and project, where you can see it": the spine's section-6 lead-in. Before
// the honest-but-abstract Z^5 panel (CutAndProject), show the same construction one
// dimension lower, fully visible. A square integer lattice, a line at the golden
// slope, and a strip (the window) around it. Lattice points inside the strip drop
// onto the line and make the Fibonacci chain: long and short intervals, ratio phi,
// never repeating. Here "cut" IS the strip and "project" IS the drop-line, both on
// screen. Slide the strip and points enter and leave; the chain reshuffles but
// keeps the same two lengths.
//
// Bound to fibonacci.ts (and fibonacci.test.ts): every accepted point and every
// long/short gap is computed, not drawn by hand. Two long/short lengths in ratio
// phi foreshadow the two Penrose tiles, so the chain is colored thick/thin.
//
// Canvas, like the other animated sketches: the harness drives render(t); t slides
// the strip offset. Theme colors are read live so it inverts with the toggle, and
// the reduced-motion end state is a clean centered strip with its chain.

const VB_W = 720;
const VB_H = 712;
const PAD = 30;

// The 2D lattice panel, the 1D chain bar, and the real Penrose patch below them.
const TOP = { x: PAD, y: 26, w: VB_W - 2 * PAD, h: 214 };
const CHAIN_Y = 288;
const CHAIN_H = 16;
const PEN = { x: PAD, y: 350, w: VB_W - 2 * PAD, h: 330 };

// How much of the lattice to show. The line of slope 1/phi runs across this box.
const VIEW_M = 7;
const VIEW_N = 5;
const S_EXT = 16; // half-length of the drawn line/strip in data units (overshoots view)

// The strip is fixed at a representative offset; the slider now builds the plane out.
const OFFSET0 = 0.05;

// The Penrose patch: the same cut-and-project, one stage up (5D -> 2D). The window is
// FIXED; the panel BUILDS the tiling outward from the centre as the slider advances,
// each tile computed from its own coordinate, never backtracking. A growing wavefront
// reveals tiles by physical radius.
const PEN_PX = 8.5; // physical half-width shown
const PEN_PY = (PEN_PX * PEN.h) / PEN.w; // matched to the panel aspect
const PEN_SCALE = Math.min(PEN.w / (2 * PEN_PX), PEN.h / (2 * PEN_PY));
const PEN_VIEW = {
  minX: -PEN_PX - 0.8,
  maxX: PEN_PX + 0.8,
  minY: -PEN_PY - 0.8,
  maxY: PEN_PY + 0.8,
};
const REVEAL_MAX = 10.2; // the build wavefront reaches this physical radius at t = 1
const REVEAL_BAND = 1.4; // soft width of the wavefront, in physical units
const penToPx = ([x, y]: V2): [number, number] => [
  PEN.x + PEN.w / 2 + x * PEN_SCALE,
  PEN.y + PEN.h / 2 - y * PEN_SCALE,
];

type Cell2D = { f: RenderFace; r: number };

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };

type V2 = readonly [number, number];
const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const scale = (k: number, v: V2): V2 => [k * v[0], k * v[1]];

// Data (m,n) plane -> pixels, equal scale so the lattice stays square, y flipped.
const SCALE = Math.min(TOP.w / (2 * VIEW_M), TOP.h / (2 * VIEW_N));
const fitD = ([x, y]: V2): [number, number] => [
  TOP.x + TOP.w / 2 + x * SCALE,
  TOP.y + TOP.h / 2 - y * SCALE,
];

// A point on the line internal = k, at parameter s along the line direction D.
const onLine = (k: number, s: number): V2 => add(scale(k, DPERP), scale(s, D));

function caption(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  ink: string,
  alpha: number,
  align: CanvasTextAlign = "center",
) {
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

function paint(
  ctx: CanvasRenderingContext2D,
  t: number,
  colors: Colors,
  cells: Cell2D[],
) {
  const { thick, thin, paper, ink } = colors;
  const offset = OFFSET0; // strip fixed; the slider builds the plane out
  const gamma = offset - WINDOW_W / 2; // center the window on the line

  ctx.clearRect(0, 0, VB_W, VB_H);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, VB_W, VB_H);

  // Panel titles.
  caption(ctx, "THE LATTICE, A LINE, A STRIP", TOP.x, 16, ink, 0.55, "left");
  caption(ctx, "build the plane below ▸", VB_W - PAD, 16, ink, 0.5, "right");

  const all = latticePoints(VIEW_M + 1, gamma).filter(
    (p) => Math.abs(p.m) <= VIEW_M && Math.abs(p.n) <= VIEW_N,
  );
  const accepted = all
    .filter((p) => p.accepted)
    .sort((a, b) => a.phys - b.phys);

  // The 1D build wavefront: reveal points (and their drops and chain) outward along
  // the line as t advances, in step with the plane building out below.
  const maxAbsPhys = accepted.reduce((m, p) => Math.max(m, Math.abs(p.phys)), 1);
  const revealPhys = t * (maxAbsPhys + 0.6);
  const revealAlpha = (phys: number) =>
    Math.max(0, Math.min(1, (revealPhys - Math.abs(phys)) / 0.6));

  // --- 2D lattice panel, clipped to its box ---------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.rect(TOP.x, TOP.y, TOP.w, TOP.h);
  ctx.clip();

  // The strip (the window): a band of one-cell width along the line.
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
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // The line E-parallel (internal = 0), through the origin at the golden slope.
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

  // Rejected lattice points: faint dots, revealed outward by the wavefront.
  for (const p of all) {
    if (p.accepted) continue;
    const ap = revealAlpha(p.phys);
    if (ap <= 0.01) continue;
    const [px, py] = fitD([p.m, p.n]);
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.22 * ap;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Accepted points, revealed outward: drop a perpendicular onto the line, then mark.
  for (const p of accepted) {
    const ap = revealAlpha(p.phys);
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
    const ap = revealAlpha(p.phys);
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

  ctx.restore(); // end clip

  // --- The 1D chain bar -----------------------------------------------------
  if (accepted.length >= 2) {
    const physMin = accepted[0].phys;
    const physMax = accepted[accepted.length - 1].phys;
    const x0 = PAD + 8;
    const x1 = VB_W - PAD - 8;
    const barX = (phys: number) =>
      x0 + ((phys - physMin) / (physMax - physMin)) * (x1 - x0);
    const mid = (LONG + SHORT) / 2;

    // Faint connectors that "unroll" the tilted line into the flat chain: each
    // revealed point's foot drops to its place on the bar.
    for (const p of accepted) {
      const ap = revealAlpha(p.phys);
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

    // The chain: a long/short bar per gap, colored like the two tiles. A gap shows
    // once both its endpoints have been revealed, so the chain builds out too.
    for (let i = 1; i < accepted.length; i++) {
      if (Math.abs(accepted[i - 1].phys) > revealPhys) continue;
      if (Math.abs(accepted[i].phys) > revealPhys) continue;
      const gap = accepted[i].phys - accepted[i - 1].phys;
      const isLong = gap > mid;
      const xa = barX(accepted[i - 1].phys);
      const xb = barX(accepted[i].phys);
      ctx.fillStyle = isLong ? thick : thin;
      ctx.fillRect(xa, CHAIN_Y - CHAIN_H / 2, xb - xa - 1.5, CHAIN_H);
    }
    // Ticks at each revealed point.
    for (const p of accepted) {
      const ap = revealAlpha(p.phys);
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
    "points inside the strip drop onto the line",
    VB_W / 2,
    TOP.y + TOP.h + 16,
    ink,
    0.7,
  );

  // --- The real Penrose tiling, BUILT OUT one stage up ----------------------
  // The window is fixed; the plane is computed outward from the centre, each tile
  // decided by its own coordinate, never backtracking. A wavefront reveals tiles by
  // physical radius as the slider advances, so the tileset is built, not mutated.
  caption(
    ctx,
    "THE SAME METHOD, ONE STAGE UP · 5D → 2D · REAL PENROSE TILES, BUILT OUTWARD",
    PEN.x,
    PEN.y - 14,
    ink,
    0.55,
    "left",
  );
  const revealR = t * REVEAL_MAX;
  ctx.save();
  ctx.beginPath();
  ctx.rect(PEN.x, PEN.y, PEN.w, PEN.h);
  ctx.clip();
  ctx.lineJoin = "round";
  for (const { f, r } of cells) {
    const appear = Math.max(0, Math.min(1, (revealR - r) / REVEAL_BAND));
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
  // The build wavefront: a faint ring at the current reach.
  if (revealR < REVEAL_MAX - 0.2) {
    const [ox, oy] = penToPx([0, 0]);
    ctx.beginPath();
    ctx.arc(ox, oy, revealR * PEN_SCALE, 0, Math.PI * 2);
    ctx.globalAlpha = 0.25;
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // --- Tie the 1D chain to the 2D tiles: the same two prototiles, one stage up -----
  // The colours already pair them (long with gold/fat, short with blue/thin). A gold
  // line links a long interval to a fat tile, a blue line a short interval to a thin
  // tile, appearing once the plane has built out. This is the analogy made visible
  // (both are cut-and-project quasicrystals with two prototiles), not a tile-by-tile
  // map between the dimensions.
  const tie = Math.max(0, Math.min(1, (t - 0.55) / 0.4));
  if (tie > 0.02 && accepted.length >= 3) {
    const physMin = accepted[0].phys;
    const physMax = accepted[accepted.length - 1].phys;
    const cx0 = PAD + 8;
    const cx1 = VB_W - PAD - 8;
    const barX = (phys: number) =>
      cx0 + ((phys - physMin) / (physMax - physMin)) * (cx1 - cx0);
    const mid = (LONG + SHORT) / 2;
    const center = (cx0 + cx1) / 2;
    let longX: number | null = null;
    let shortX: number | null = null;
    let bestL = Infinity;
    let bestS = Infinity;
    for (let i = 1; i < accepted.length; i++) {
      const gap = accepted[i].phys - accepted[i - 1].phys;
      const segX = (barX(accepted[i - 1].phys) + barX(accepted[i].phys)) / 2;
      const d = Math.abs(segX - center);
      if (gap > mid) {
        if (d < bestL) { bestL = d; longX = segX; }
      } else if (d < bestS) { bestS = d; shortX = segX; }
    }
    const revealR = t * REVEAL_MAX;
    let fat: V2 | null = null;
    let thn: V2 | null = null;
    let bestFat = Infinity;
    let bestThin = Infinity;
    for (const { f, r } of cells) {
      if (r >= revealR) continue;
      if (f.type === "thick") {
        if (r < bestFat) { bestFat = r; fat = [f.centroid[0], f.centroid[1]]; }
      } else if (r < bestThin) { bestThin = r; thn = [f.centroid[0], f.centroid[1]]; }
    }
    const tieLine = (segX: number | null, tile: V2 | null, color: string) => {
      if (segX == null || tile == null) return;
      const [tx, ty] = penToPx(tile);
      ctx.save();
      ctx.globalAlpha = tie * 0.8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(segX, CHAIN_Y + CHAIN_H / 2 + 3);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(segX, CHAIN_Y + CHAIN_H / 2 + 3, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(tx, ty, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    tieLine(longX, fat, thick);
    tieLine(shortX, thn, thin);
  }

  caption(
    ctx,
    "the plane is computed outward, tile by tile; the two lengths become the two tiles",
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

  // Precompute the fixed Penrose patch once, each tile tagged with its physical radius
  // so the build wavefront can reveal them outward without re-enumerating.
  const cells = useMemo<Cell2D[]>(
    () =>
      facesInViewport(PEN_VIEW, GAMMA).map((f) => ({
        f,
        r: Math.hypot(f.centroid[0], f.centroid[1]),
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

  // A quietly informative caption for screen readers describing the static state.
  const accepted = latticePoints(VIEW_M + 1, OFFSET0 - WINDOW_W / 2).filter(
    (p: LatPt) =>
      p.accepted && Math.abs(p.m) <= VIEW_M && Math.abs(p.n) <= VIEW_N,
  ).length;

  return (
    <Sketch
      label="sketch 04 · cut and project, in a dimension you can see"
      animation={{ duration: 8000, render, slider: { label: "build" } }}
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
        aria-label={`The cut-and-project method shown one dimension down, fully visible. A square integer lattice, a straight line through the origin at the golden slope, and a strip of one-cell width around it forming the acceptance window. The ${accepted} lattice points inside the strip each drop a perpendicular onto the line; those feet, laid flat below, form the Fibonacci chain of long and short intervals whose lengths are in ratio phi and whose order never repeats. Cut is the strip, project is the drop-line. Below that is a real two-dimensional Penrose tiling produced by the same cut and project one stage up, from five dimensions to two. As the slider advances, that plane is built outward from the centre behind a growing wavefront, each tile computed from its own coordinate with no backtracking, so you watch the tileset get built rather than mutated.`}
      />
    </Sketch>
  );
}
