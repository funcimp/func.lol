"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import { buildOverlay, FIFTH, rotate, type Overlay, type Pt } from "./lib/overlay";

// "Slide one over another": the spine's section-7 sketch, Penrose's overhead-
// projector demo, rebuilt to be a thing you push around. Two real Penrose tilings are
// drawn as line work, the bottom in ink and the top in a translucent accent. Drag the
// top layer to slide it; the twist control turns it about the center. Zoomed out, the
// places where the two disagree organize into the five-fold rosettes Penrose saw, and
// they shift and breathe as you move the top layer.
//
// HONEST BY CONSTRUCTION. Both layers are the SAME real enumerator patch (lib/overlay.ts
// and its test). The interference is emergent: nothing is tinted or highlighted, the
// moiré is just two real tilings overlapping. The two share every finite patch yet
// never line up everywhere at once.
//
// The harness drives render(t) for the twist (and play/reduced-motion); pointer drag
// translates the top layer independently, repainting at the current twist. Theme
// colors are read live so it inverts with the toggle.

const VB_W = 560;
const VB_H = 560;
const MARGIN = 12;
// Zoomed out: a large patch generated, a tighter window shown, so the top layer still
// covers the frame as it is dragged and turned.
const GEN_HALF = 15;
const VIEW_HALF = 12;
const TWIST_MAX = 0.16 * FIFTH; // up to ~11.5 degrees: dramatic rosettes that morph
const OFFSET_MAX = 3.5; // how far the top layer may be dragged, in tile-edge units

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };

const SCALE = Math.min(VB_W - 2 * MARGIN, VB_H - 2 * MARGIN) / (2 * VIEW_HALF);
const toPx = (p: Pt): [number, number] => [
  VB_W / 2 + p[0] * SCALE,
  VB_H / 2 - p[1] * SCALE, // canvas y grows downward
];

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

function strokeFaces(
  ctx: CanvasRenderingContext2D,
  faces: Overlay["a"],
  xf: ((p: Pt) => Pt) | null,
  color: string,
  width: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const f of faces) {
    const c = f.corners;
    const p0 = xf ? xf(c[0]) : c[0];
    const [x0, y0] = toPx(p0);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < c.length; i++) {
      const p = xf ? xf(c[i]) : c[i];
      const [x, y] = toPx(p);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  ctx.stroke();
  ctx.restore();
}

function caption(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  ink: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ink;
  ctx.font =
    "11px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function paint(
  ctx: CanvasRenderingContext2D,
  twist: number,
  offset: Pt,
  o: Overlay,
  colors: Colors,
) {
  const { thick, paper, ink } = colors;

  ctx.clearRect(0, 0, VB_W, VB_H);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, VB_W, VB_H);

  // BOTTOM layer: the real tiling, in place, ink line work.
  strokeFaces(ctx, o.a, null, ink, 0.7, 0.5);

  // TOP layer: the SAME tiling, turned by `twist` about the center then slid by the
  // drag offset, in translucent accent. Where it falls off the bottom seams the two
  // agree; where it cuts across, the five-fold veins of mismatch appear.
  const xf = (p: Pt): Pt => {
    const r = rotate(p, twist);
    return [r[0] + offset[0], r[1] + offset[1]];
  };
  strokeFaces(ctx, o.b, xf, thick, 0.95, 0.62);

  caption(
    ctx,
    "drag the top layer to slide it · twist to turn",
    VB_W / 2,
    VB_H - 16,
    ink,
    0.7,
  );
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
  const overlay = useMemo(() => buildOverlay(GEN_HALF), []);

  // Twist comes from the harness clock/slider (t); offset comes from pointer drag.
  // Both feed the same paint, repainting on either.
  const twistRef = useRef(TWIST_MAX); // mount at the representative twist (t = 1)
  const offsetRef = useRef<Pt>([0, 0]);

  const refreshColors = useCallback(() => {
    colorsRef.current = {
      thick: readVar("--color-penrose-thick", "#C89B3C"),
      thin: readVar("--color-penrose-thin", "#3E6B7C"),
      paper: readVar("--color-paper", "#0f0e0c"),
      ink: readVar("--color-ink", "#ede9d8"),
    };
  }, []);

  const repaint = useCallback(() => {
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
    paint(ctx, twistRef.current, offsetRef.current, overlay, colorsRef.current);
  }, [overlay, refreshColors]);

  const render = useCallback(
    (t: number) => {
      twistRef.current = t * TWIST_MAX;
      repaint();
    },
    [repaint],
  );

  // Pointer drag translates the top layer. Pixel deltas convert to data units through
  // the canvas's on-screen scale, with the y axis flipped.
  const dragging = useRef(false);
  const last = useRef<[number, number]>([0, 0]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    dragging.current = true;
    last.current = [e.clientX, e.clientY];
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragging.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const perData = rect.width / VB_W; // CSS px per data unit = (css/view px)*(view px/data)
      const k = perData * SCALE;
      const dx = (e.clientX - last.current[0]) / k;
      const dy = -(e.clientY - last.current[1]) / k;
      last.current = [e.clientX, e.clientY];
      offsetRef.current = [
        clamp(offsetRef.current[0] + dx, OFFSET_MAX),
        clamp(offsetRef.current[1] + dy, OFFSET_MAX),
      ];
      repaint();
    },
    [repaint],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  // Repaint on theme flip so the stationary state inverts with the toggle.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      refreshColors();
      repaint();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [refreshColors, repaint]);

  return (
    <Sketch
      label="sketch 06 · two tilings, one slid over the other"
      animation={{ duration: 9000, render, slider: { label: "twist" } }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          width: "100%",
          height: "auto",
          aspectRatio: `${VB_W} / ${VB_H}`,
          touchAction: "none",
          cursor: "grab",
        }}
        className="block w-full bg-paper"
        role="img"
        aria-label="Two real Penrose tilings drawn as line work and overlaid, zoomed out. The bottom layer is ink; the same tiling is drawn again over it in a translucent accent. Dragging the top layer slides it, and a twist control turns it about the center. Where the two tilings disagree, the mismatch organizes into five-fold rosettes that shift and breathe as the top layer moves. Broad regions still agree while veins of mismatch run between them, all carrying the five-fold symmetry. The two share every finite patch yet never line up everywhere at once, which is what Penrose saw on his overhead projector."
      />
    </Sketch>
  );
}
