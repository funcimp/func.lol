"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import {
  buildOverlay,
  coincidentKeys,
  FIFTH,
  rotate,
  type Overlay,
  type Pt,
} from "./lib/overlay";

// "Slide one over another": the spine's section-7 sketch, Penrose's overhead-
// projector demo. Two real Penrose tilings are laid over each other; turning one
// makes broad regions snap into agreement while veins of mismatch ripple between
// them, organized by the five-fold symmetry. Any two share every finite patch, yet
// they never line up everywhere at once.
//
// HONEST BY CONSTRUCTION. Both layers are real enumerator output (see lib/overlay.ts
// and its test). Layer A is a real patch, filled, muted so the overlay reads. Layer
// B is the SAME real patch, drawn as contrasting ink edges, rotated about the patch
// center by the slider, exactly the transparency Penrose turned. The interference is
// emergent: overlay the two and the islands and veins appear on their own. We add a
// faint tint only where the two GENUINELY coincide under the current angle
// (coincidentKeys, real near-coincidence within a stated tolerance), so the islands
// read without a single painted-on highlight.
//
// Canvas, like the other animated sketches: the harness drives render(t)
// imperatively and the slider scrubs the turn. Theme colours are read live so the
// patch inverts with the light/dark toggle. Reduced motion is honored by the harness
// mounting at the representative end state (t = 1), a clean islands-and-veins frame.

const VB_W = 560;
const VB_H = 560;
const MARGIN = 14;
// Physical extent shown. The patch spans about ±8.5; we frame a touch inside so the
// rotated layer B still covers the corners through the whole turn.
const HALF = 7.6;
// The slider sweeps from exact coincidence to a frame with clear islands and veins.
// t = 0 is the two tilings on top of each other (near-coincidence); t = 1 lands on a
// generic angle whose agreement clusters into islands separated by veins, the
// representative reduced-motion frame. Below a full fifth-turn, so the motion never
// returns to a global match.
const ANGLE_MAX = 0.475 * FIFTH;

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };

const SCALE = Math.min(VB_W - 2 * MARGIN, VB_H - 2 * MARGIN) / (2 * HALF);
const toPx = (p: Pt): [number, number] => [
  VB_W / 2 + p[0] * SCALE,
  VB_H / 2 - p[1] * SCALE, // canvas y grows downward
];

function pathPoly(ctx: CanvasRenderingContext2D, v: readonly Pt[], xf?: (p: Pt) => Pt) {
  ctx.beginPath();
  const first = xf ? xf(v[0]) : v[0];
  const [x0, y0] = toPx(first);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < v.length; i++) {
    const p = xf ? xf(v[i]) : v[i];
    const [x, y] = toPx(p);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function paint(ctx: CanvasRenderingContext2D, t: number, o: Overlay, colors: Colors) {
  const { thick, thin, paper, ink } = colors;
  const angle = t * ANGLE_MAX;
  const tinted = coincidentKeys(o, angle);

  ctx.clearRect(0, 0, VB_W, VB_H);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, VB_W, VB_H);

  // LAYER A: the real patch, filled and muted so layer B reads over it. The
  // agreement tint sits on top of the coincident A tiles, faint and honest.
  for (const f of o.a) {
    pathPoly(ctx, f.corners);
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = f.type === "thick" ? thick : thin;
    ctx.fill();
    ctx.restore();
  }

  // The agreement islands: a faint ink wash on tiles that genuinely coincide with a
  // rotated layer-B tile right now. Real near-coincidence only; never painted on.
  if (tinted.size > 0) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = ink;
    for (const f of o.a) {
      if (!tinted.has(f.key)) continue;
      pathPoly(ctx, f.corners);
      ctx.fill();
    }
    ctx.restore();
  }

  // LAYER B: the same real tiling, edges only, rotated about the center. Contrasting
  // ink, semi-transparent, so where it falls on layer A's seams the two agree and
  // where it cuts across them the veins of mismatch show.
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.9;
  ctx.lineJoin = "round";
  const xf = (p: Pt) => rotate(p, angle);
  for (const f of o.b) {
    pathPoly(ctx, f.corners, xf);
    ctx.stroke();
  }
  ctx.restore();
}

export default function InterferenceOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({
    thick: "#C89B3C",
    thin: "#3E6B7C",
    paper: "#0f0e0c",
    ink: "#ede9d8",
  });
  const dprRef = useRef(0);
  const overlay = useMemo(() => buildOverlay(), []);

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
      paint(ctx, t, overlay, colorsRef.current);
    },
    [overlay, refreshColors],
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
      label="sketch 06 · two tilings, one turned over the other"
      animation={{ duration: 9000, render, slider: { label: "turn" } }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "auto", aspectRatio: `${VB_W} / ${VB_H}` }}
        className="block w-full bg-paper"
        role="img"
        aria-label="Two real Penrose tilings overlaid. One is filled in muted gold and teal rhombi; the same tiling is drawn again as semi-transparent ink edges over it and slowly turned about the center. Turning the top layer makes broad regions snap into agreement, faintly tinted where the two genuinely coincide, while veins of mismatch ripple between those islands. The whole map of islands and veins is organized by the five-fold symmetry. The two share every finite patch yet never line up everywhere at once, which is what Penrose saw on his overhead projector."
      />
    </Sketch>
  );
}
