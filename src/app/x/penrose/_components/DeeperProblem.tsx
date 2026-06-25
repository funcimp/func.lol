"use client";

import { useCallback, useEffect, useRef } from "react";

import Sketch from "./Sketch";
import {
  forcedGapIndex,
  patchRhombi,
  type PatchRhombus,
  type Pt,
} from "./lib/deeperPatch";

// "The deeper problem": the spine's section-5 sketch. The dead-end taught that a
// local rule can paint you into a corner. This teaches the harder, non-local truth:
// you can lay a WHOLE region perfectly, every tile obeying the rule, and still be
// globally doomed, with the contradiction forced FAR from any choice you made.
// Penrose's lawn: the bad tile is at the edge, but it "goes wrong in the middle."
//
// So the framing is zoomed out. A real Penrose patch grows outward from a seed,
// ring by ring, every placement clean. The viewer should feel "this is going fine"
// as it fills. Then, out near the rim and distant from the center, ONE tile is
// struck as the forced unfillable gap. A faint line runs from the seed to that tile
// so the DISTANCE between "where you were placing tiles fine" and "where it breaks"
// reads at a glance. That distance is the whole point.
//
// Hand-authored honesty: the patch is a genuine Penrose tiling (built by the
// substitution rule in lib/deeperPatch), so it looks flawless everywhere. The
// failure is a crafted mark on one far tile, a teaching staging, not a solver. The
// global engine the explorer runs never dead-ends; only a local hand does.
//
// Canvas, like the dead-end: the harness drives render(t) imperatively, theme
// colours are read live via getComputedStyle so the patch inverts with the toggle.

const VB_W = 560;
const VB_H = 440;
const MARGIN = 30; // px around the patch inside the viewBox

// Substitution depth and seed size. Four deflations of a decagonal wheel give a
// patch dense enough that the rim sits visibly far from the seed, while still
// reading tile by tile when zoomed out.
const LEVELS = 4;
const SEED_RADIUS = 10;
const GAP_BEARING = -Math.PI * 0.36; // up-and-right; where the rim breaks

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; grout: string; ink: string };

// smoothstep for gentle per-tile and per-stage fades.
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// The patch is built once and reused across frames: the geometry is deterministic,
// only the reveal moves. A module-level cache keeps the work off the render path.
type Built = {
  rhombi: PatchRhombus[];
  gapIndex: number;
  maxR: number;
  // viewBox transform: patch units -> canvas px (centered, fit with margin).
  scale: number;
  ox: number;
  oy: number;
  seed: Pt; // seed center in canvas px
  gapCenter: Pt; // forced-gap centroid in canvas px
};

let cache: Built | null = null;

function build(): Built {
  if (cache) return cache;
  const rhombi = patchRhombi(LEVELS, SEED_RADIUS);
  const gapIndex = forcedGapIndex(rhombi, GAP_BEARING);
  const maxR = rhombi.reduce((m, r) => Math.max(m, r.radius), 0);

  // Fit the patch (centered on the origin, half-extent ~= maxR plus a tile) into
  // the viewBox with a margin. Zoomed out: the whole grown region is visible.
  const extent = maxR + SEED_RADIUS / 6;
  const scale = Math.min(
    (VB_W - 2 * MARGIN) / (2 * extent),
    (VB_H - 2 * MARGIN) / (2 * extent),
  );
  const ox = VB_W / 2;
  const oy = VB_H / 2;
  const toPx = (p: Pt): Pt => [ox + p[0] * scale, oy - p[1] * scale];

  cache = {
    rhombi,
    gapIndex,
    maxR,
    scale,
    ox,
    oy,
    seed: [ox, oy],
    gapCenter: toPx(rhombi[gapIndex].center),
  };
  return cache;
}

function fillRhombus(
  ctx: CanvasRenderingContext2D,
  corners: readonly Pt[],
  toPx: (p: Pt) => Pt,
  fill: string,
  ink: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  const [x0, y0] = toPx(corners[0]);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < corners.length; i++) {
    const [x, y] = toPx(corners[i]);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.restore();
}

// Paint the whole patch at normalised time t. Three stages:
//   [0, GROW_END]      grow outward from the seed, ring by ring, every tile clean.
//   [GROW_END, MARK]   draw the seed marker and the line out to the doomed tile.
//   [MARK, 1]          strike the forced gap and label it. End state at t = 1.
const GROW_END = 0.74;
const MARK_END = 0.88;

function paint(ctx: CanvasRenderingContext2D, t: number, colors: Colors) {
  const { thick, thin, grout, ink } = colors;
  const b = build();
  const { rhombi, gapIndex, maxR, scale, ox, oy, seed, gapCenter } = b;
  const toPx = (p: Pt): Pt => [ox + p[0] * scale, oy - p[1] * scale];

  ctx.clearRect(0, 0, VB_W, VB_H);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, VB_W, VB_H);

  // Grow front: a radius that sweeps from center to rim over [0, GROW_END]. Each
  // rhombus fades in as the front crosses its centroid, so the patch fills like a
  // ripple from the seed. A small band gives each ring a soft leading edge.
  const front = smooth(0, GROW_END, t) * (maxR * 1.04);
  const band = maxR * 0.16;

  rhombi.forEach((r, i) => {
    if (i === gapIndex) return; // the doomed slot is drawn separately, as a gap
    const appear = smooth(r.radius - band, r.radius, front);
    if (appear <= 0) return;
    fillRhombus(
      ctx,
      r.corners,
      toPx,
      r.kind === "thick" ? thick : thin,
      ink,
      appear,
    );
  });

  // The forced-gap slot. Until the mark stage it simply stays empty (an absence in
  // the rim that the eye barely registers while everything else reads as fine).
  // Then a faint outline shows the slot that "should" take a tile.
  const gap = rhombi[gapIndex];
  const slotReveal = smooth(GROW_END, MARK_END, t);
  if (slotReveal > 0) {
    ctx.save();
    ctx.globalAlpha = slotReveal * 0.5;
    ctx.beginPath();
    const [gx0, gy0] = toPx(gap.corners[0]);
    ctx.moveTo(gx0, gy0);
    for (let i = 1; i < gap.corners.length; i++) {
      const [x, y] = toPx(gap.corners[i]);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.restore();
  }

  // The distance line: seed -> doomed tile, drawn once the patch is grown. It makes
  // the non-locality literal: you placed tiles cleanly here (the seed), it broke
  // way out there (the rim), with nothing wrong in between.
  const lineReveal = smooth(GROW_END, MARK_END, t);
  if (lineReveal > 0) {
    ctx.save();
    ctx.globalAlpha = lineReveal * 0.5;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(seed[0], seed[1]);
    ctx.lineTo(gapCenter[0], gapCenter[1]);
    ctx.stroke();
    ctx.restore();

    // Seed marker: a small ring at the center, labelled. "You started here."
    ctx.save();
    ctx.globalAlpha = lineReveal;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(seed[0], seed[1], 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.globalAlpha = lineReveal * 0.7;
    ctx.font =
      "10px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("SEED", seed[0] + 9, seed[1]);
    ctx.restore();
  }

  // Strike the forced gap and label it. This is the representative end state at
  // t = 1: a clean patch with one distant, struck-out, unfillable tile.
  const strike = smooth(MARK_END, 1, t);
  if (strike > 0) {
    const [cx, cy] = gapCenter;
    ctx.save();
    ctx.globalAlpha = strike;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    const span = 11;
    ctx.beginPath();
    ctx.moveTo(cx - span, cy - span);
    ctx.lineTo(cx + span, cy + span);
    ctx.moveTo(cx + span, cy - span);
    ctx.lineTo(cx - span, cy + span);
    ctx.stroke();

    // A ring around the doomed tile so it pops out near the rim.
    ctx.globalAlpha = strike * 0.8;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, span + 7, 0, Math.PI * 2);
    ctx.stroke();

    // Label placed clear of the rim, toward the nearer canvas edge.
    ctx.globalAlpha = strike * 0.9;
    ctx.fillStyle = ink;
    ctx.font =
      "11px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";
    const labelRight = cx < VB_W / 2;
    ctx.textAlign = labelRight ? "left" : "right";
    ctx.textBaseline = "middle";
    const lx = labelRight ? cx + span + 12 : cx - span - 12;
    ctx.fillText("FORCED GAP", lx, cy - 7);
    ctx.globalAlpha = strike * 0.6;
    ctx.fillText("no legal tile", lx, cy + 7);
    ctx.restore();
  }
}

export default function DeeperProblem() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({
    thick: "#C89B3C",
    thin: "#3E6B7C",
    grout: "#0f0e0c",
    ink: "#ede9d8",
  });
  const dprRef = useRef(0);

  const refreshColors = useCallback(() => {
    colorsRef.current = {
      thick: readVar("--color-penrose-thick", "#C89B3C"),
      thin: readVar("--color-penrose-thin", "#3E6B7C"),
      grout: readVar("--color-paper", "#0f0e0c"),
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

  // Repaint on theme flip so the stationary end state inverts with the toggle.
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

  return (
    <Sketch
      label="sketch 03 · the deeper problem"
      animation={{ duration: 6400, render, slider: { label: "grow" } }}
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
        aria-label="A Penrose patch grows outward from a seed at the center, ring by ring, every tile obeying the matching rule and looking flawless. Out near the rim, far from the seed, one tile is struck through and labelled a forced gap with no legal tile: a contradiction forced far from any visible mistake. A faint dashed line connects the clean seed to the distant failure."
      />
    </Sketch>
  );
}
