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
} from "./lib/fibonacci";

// "Cut and project, where you can see it": the spine's section-6 lead-in. The same
// construction one dimension lower, fully visible. A square integer lattice, a line at
// the golden slope, and a strip (the window) around it. SLIDE the strip across the
// lattice: the points that fall inside it drop onto the line and form the Fibonacci
// chain, long and short intervals, ratio phi, never repeating. As the strip slides the
// selection shifts, which is the cut choosing the sequence. Cut is the strip, project
// is the drop. This is the cut-and-project method made visible; Penrose is the same
// method one dimension up (5D -> 2D), which the next sketches show on the plane.
//
// Bound to fibonacci.ts (and fibonacci.test.ts): every accepted point and every
// long/short gap is computed, not drawn by hand. This sketch shows ONLY the 1D
// construction, which is fully traceable on its own (lattice point -> its drop -> the
// interval it bounds). It does not claim to draw the 2D Penrose tiles, which come from
// a different lattice (the pentagrid / cut-and-project sketches handle those).
//
// Canvas: the harness drives render(t); t slides the strip's offset across the lattice.
// Theme colours are read live. Reduced motion mounts at t = 1, the representative
// centred chain.

const VB_W = 680;
const VB_H = 380;
const PAD = 30;

const TOP = { x: PAD, y: 26, w: VB_W - 2 * PAD, h: 230 };
const CHAIN_Y = 304;
const CHAIN_H = 18;

// How much of the lattice to show. The line of slope 1/phi runs across this box.
const VIEW_M = 7;
const VIEW_N = 5;
const S_EXT = 16; // half-length of the drawn line/strip in data units (overshoots view)
const OFFSET0 = 0.05; // representative window offset at t = 1 (clean, near-centred chain)
const OFFSET_SPAN = WINDOW_W * 1.4; // how far the strip slides across the lattice as t runs

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

function paint(ctx: CanvasRenderingContext2D, t: number, colors: Colors) {
  const { thick, thin, paper, ink } = colors;
  const offset = OFFSET0 + (t - 1) * OFFSET_SPAN; // t = 1 -> OFFSET0 (representative)
  const gamma = offset - WINDOW_W / 2; // centre the window band on the line

  ctx.clearRect(0, 0, VB_W, VB_H);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, VB_W, VB_H);

  caption(ctx, "THE LATTICE, A LINE, A STRIP", TOP.x, 16, ink, 0.55, "left");
  caption(ctx, "◂ slide the strip across the grid ▸", VB_W - PAD, 16, ink, 0.5, "right");

  // The accepted set is recomputed for the current offset, so as the strip slides the
  // selection shifts: points enter and leave the window and the chain changes with it.
  const all = latticePoints(VIEW_M + 1, gamma).filter(
    (p) => Math.abs(p.m) <= VIEW_M && Math.abs(p.n) <= VIEW_N,
  );
  const accepted = all
    .filter((p) => p.accepted)
    .sort((a, b) => a.phys - b.phys);

  // --- lattice panel, clipped -----------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.rect(TOP.x, TOP.y, TOP.w, TOP.h);
  ctx.clip();

  // The strip (the window) at the current offset. This is the element that slides.
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

  // The line (internal = 0), through the origin at the golden slope.
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

  // Rejected lattice points: faint dots, outside the window.
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
  ctx.globalAlpha = 1;

  ctx.restore(); // end clip

  // --- the 1D chain bar ------------------------------------------------------
  // The current selection, projected flat. As the strip slides the gaps shift, which
  // is the same quasiperiodic chain read from a different cut.
  if (accepted.length >= 2) {
    const physMin = accepted[0].phys;
    const physMax = accepted[accepted.length - 1].phys;
    const x0 = PAD + 8;
    const x1 = VB_W - PAD - 8;
    const barX = (phys: number) =>
      x0 + ((phys - physMin) / (physMax - physMin || 1)) * (x1 - x0);
    const mid = (LONG + SHORT) / 2;
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
    for (let i = 1; i < accepted.length; i++) {
      const gap = accepted[i].phys - accepted[i - 1].phys;
      const isLong = gap > mid;
      const xa = barX(accepted[i - 1].phys);
      const xb = barX(accepted[i].phys);
      ctx.fillStyle = isLong ? thick : thin;
      ctx.fillRect(xa, CHAIN_Y - CHAIN_H / 2, xb - xa - 1.5, CHAIN_H);
    }
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
      CHAIN_Y + CHAIN_H / 2 + 24,
      ink,
      0.78,
    );
  }

  caption(
    ctx,
    "points inside the strip drop onto the line as it slides",
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
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
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

  const accepted = latticePoints(VIEW_M + 1, OFFSET0 - WINDOW_W / 2).filter(
    (p) => p.accepted && Math.abs(p.m) <= VIEW_M && Math.abs(p.n) <= VIEW_N,
  ).length;

  return (
    <Sketch
      label="sketch 04 · cut and project, in a dimension you can see"
      animation={{ duration: 8000, render, slider: { label: "slide" } }}
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
        aria-label={`The cut-and-project method shown one dimension down, fully visible. A square integer lattice, a straight line through the origin at the golden slope, and a strip of one-cell width around it forming the acceptance window. Sliding the control slides the strip across the lattice; the roughly ${accepted} lattice points that fall inside the strip drop a perpendicular onto the line, and those feet, laid flat below, form the Fibonacci chain of long and short intervals whose lengths are in ratio phi and whose order never repeats. As the strip slides the selection shifts. This is the cut-and-project method made visible in a dimension you can see; Penrose tilings are the same method one dimension up, from five dimensions to two, shown in the sketches that follow.`}
      />
    </Sketch>
  );
}
