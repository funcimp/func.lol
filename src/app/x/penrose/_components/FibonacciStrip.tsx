"use client";

import { useCallback, useEffect, useRef } from "react";

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
const VB_H = 440;
const PAD = 30;

// The 2D lattice panel and the 1D chain bar below it.
const TOP = { x: PAD, y: 30, w: VB_W - 2 * PAD, h: 264 };
const CHAIN_Y = 372;
const CHAIN_H = 16;

// How much of the lattice to show. The line of slope 1/phi runs across this box.
const VIEW_M = 7;
const VIEW_N = 5;
const S_EXT = 16; // half-length of the drawn line/strip in data units (overshoots view)

// The strip slides over ~1.4 cell widths as t goes 0 -> 1, so several points cross.
const OFFSET_SPAN = WINDOW_W * 1.4;
const OFFSET0 = 0.05; // representative offset at t = 1 (near-centered, clean chain)

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

function paint(ctx: CanvasRenderingContext2D, t: number, colors: Colors) {
  const { thick, thin, paper, ink } = colors;
  const offset = OFFSET0 + (t - 1) * OFFSET_SPAN; // t = 1 -> OFFSET0 (representative)
  const gamma = offset - WINDOW_W / 2; // center the window on the line

  ctx.clearRect(0, 0, VB_W, VB_H);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, VB_W, VB_H);

  // Panel titles.
  caption(ctx, "THE LATTICE, A LINE, A STRIP", TOP.x, 16, ink, 0.55, "left");
  caption(
    ctx,
    "slide the strip",
    VB_W - PAD,
    16,
    ink,
    0.5,
    "right",
  );

  const all = latticePoints(VIEW_M + 1, gamma).filter(
    (p) => Math.abs(p.m) <= VIEW_M && Math.abs(p.n) <= VIEW_N,
  );
  const accepted = all
    .filter((p) => p.accepted)
    .sort((a, b) => a.phys - b.phys);

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

  // Rejected lattice points: faint dots. Accepted handled below so they sit on top.
  for (const p of all) {
    if (p.accepted) continue;
    const [px, py] = fitD([p.m, p.n]);
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.22;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Accepted points: drop a perpendicular onto the line, then mark the point.
  for (const p of accepted) {
    const foot = scale(physical(p.m, p.n), D);
    const [pxx, pyy] = fitD([p.m, p.n]);
    const [fxx, fyy] = fitD(foot);
    ctx.beginPath();
    ctx.moveTo(pxx, pyy);
    ctx.lineTo(fxx, fyy);
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of accepted) {
    const [px, py] = fitD([p.m, p.n]);
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
    // accepted point's foot drops to its place on the bar.
    for (const p of accepted) {
      const foot = scale(physical(p.m, p.n), D);
      const [, fy] = fitD(foot);
      const bx = barX(p.phys);
      ctx.beginPath();
      ctx.moveTo(fitD(foot)[0], fy);
      ctx.lineTo(bx, CHAIN_Y - CHAIN_H / 2 - 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.12;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // The chain: a long/short bar per gap, colored like the two tiles.
    for (let i = 1; i < accepted.length; i++) {
      const gap = accepted[i].phys - accepted[i - 1].phys;
      const isLong = gap > mid;
      const xa = barX(accepted[i - 1].phys);
      const xb = barX(accepted[i].phys);
      ctx.fillStyle = isLong ? thick : thin;
      ctx.fillRect(xa, CHAIN_Y - CHAIN_H / 2, xb - xa - 1.5, CHAIN_H);
    }
    // Ticks at each projected point.
    for (const p of accepted) {
      const bx = barX(p.phys);
      ctx.beginPath();
      ctx.moveTo(bx, CHAIN_Y - CHAIN_H / 2 - 3);
      ctx.lineTo(bx, CHAIN_Y + CHAIN_H / 2 + 3);
      ctx.lineWidth = 1;
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.5;
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
    TOP.y + TOP.h + 18,
    ink,
    0.7,
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
      paint(ctx, t, colorsRef.current);
    },
    [refreshColors],
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
      animation={{ duration: 7000, render, slider: { label: "strip" } }}
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
        aria-label={`The cut-and-project method shown one dimension down, fully visible. A square integer lattice, a straight line through the origin at the golden slope, and a strip of one-cell width around it forming the acceptance window. The ${accepted} lattice points inside the strip each drop a perpendicular onto the line; those feet, laid flat below, form the Fibonacci chain of long and short intervals whose lengths are in ratio phi and whose order never repeats. Cut is the strip, project is the drop-line. Sliding the strip lets points enter and leave and reshuffles the chain, but the two lengths never change. This is the same construction the explorer runs from five dimensions down to two.`}
      />
    </Sketch>
  );
}
