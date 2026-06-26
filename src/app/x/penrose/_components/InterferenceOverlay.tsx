"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import { buildOverlay, type Overlay, type Pt } from "./lib/overlay";

// "Slide one over another": the spine's section-7 sketch, Penrose's overhead-
// projector demo, rebuilt to push and spin. Two real Penrose tilings are drawn as
// line work over a large plane that runs well off screen, the bottom in ink and the
// top in a translucent accent. Spin the top layer a full turn, or drag it, and the
// places where the two disagree organize into five-fold rosettes that bloom and
// drift. Zoomed out, those rosettes read at scale; the off-screen plane means there
// is always tiling under the frame to move into view.
//
// HONEST BY CONSTRUCTION. Both layers are the SAME real enumerator patch
// (lib/overlay.ts and its test). The interference is emergent: nothing is tinted,
// the moiré is just two real tilings overlapping. Only the visible tiles are drawn
// each frame (culled by centroid), so a large plane stays smooth to spin and drag.
//
// The harness drives render(t) for the spin (full 360, looping); pointer drag slides
// the top layer. Theme colours are read live so it inverts with the toggle.

const VB = 560;
const MARGIN = 10;
// Zoomed far out over a large generated plane, so the five-fold interference rosettes
// read at scale and dragging never runs out of tiling.
const VIEW_HALF = 42;
const GEN_HALF = 75;
const CULL_R = VIEW_HALF + 2; // draw only tiles whose centroid is within the frame
// The tilings carry five-fold symmetry, so a full spin just repeats; one fifth of a
// turn is the whole story. The slider turns the top layer across [0, 72 deg].
const TURN_MAX = (2 * Math.PI) / 5;
const OFFSET_MAX = 12; // how far the top layer may be dragged, in tile-edge units

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };

const SCALE = (VB - 2 * MARGIN) / (2 * VIEW_HALF);
const toPx = (p: Pt): [number, number] => [
  VB / 2 + p[0] * SCALE,
  VB / 2 - p[1] * SCALE, // canvas y grows downward
];

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

// Stroke a list of faces (optionally transformed) in one path. Caller culls first.
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
  // The bottom layer is fixed; its visible tiles never change, so cull once.
  const bottomVisible = useMemo(
    () =>
      overlay.a.filter(
        (f) => Math.abs(f.centroid[0]) <= CULL_R && Math.abs(f.centroid[1]) <= CULL_R,
      ),
    [overlay],
  );

  const twistRef = useRef(TURN_MAX); // mount at a fifth-turn (t = 1), full interference
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
      canvas.width = VB * dpr;
      canvas.height = VB * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      refreshColors();
    }
    const { thick, paper, ink } = colorsRef.current;
    const twist = twistRef.current;
    const [ox, oy] = offsetRef.current;
    const cos = Math.cos(twist);
    const sin = Math.sin(twist);
    const xf = (p: Pt): Pt => [p[0] * cos - p[1] * sin + ox, p[0] * sin + p[1] * cos + oy];

    ctx.clearRect(0, 0, VB, VB);
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, VB, VB);

    // BOTTOM layer: the fixed tiling, faint thin ink, so the top reads crisply over it.
    strokeFaces(ctx, bottomVisible, null, ink, 0.5, 0.3);

    // TOP layer: the same tiling, spun and slid, in translucent accent. Cull by the
    // transformed centroid so only what lands in the frame is drawn.
    const topVisible = overlay.b.filter((f) => {
      const cx = f.centroid[0] * cos - f.centroid[1] * sin + ox;
      const cy = f.centroid[0] * sin + f.centroid[1] * cos + oy;
      return Math.abs(cx) <= CULL_R && Math.abs(cy) <= CULL_R;
    });
    strokeFaces(ctx, topVisible, xf, thick, 0.7, 0.85);

    caption(ctx, "drag to slide the top layer · turn it up to a fifth", VB / 2, VB - 14, ink, 0.7);
  }, [overlay, bottomVisible, refreshColors]);

  const render = useCallback(
    (t: number) => {
      twistRef.current = t * TURN_MAX;
      repaint();
    },
    [repaint],
  );

  // Pointer drag translates the top layer. Pixel deltas convert to data units.
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
      const k = (rect.width / VB) * SCALE; // CSS px per data unit
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
      label="sketch 07 · two tilings, one turned over the other"
      animation={{ duration: 7000, render, slider: { label: "turn" } }}
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
          aspectRatio: "1 / 1",
          touchAction: "none",
          cursor: "grab",
        }}
        className="block w-full bg-paper"
        role="img"
        aria-label="Two real Penrose tilings drawn as line work and overlaid over a large plane that runs off screen, zoomed far out. The bottom layer is ink; the same tiling is drawn over it in a translucent accent. The turn control rotates the top layer across one fifth of a turn, the fundamental range for a five-fold tiling, and dragging slides it. Where the two tilings disagree, the mismatch organizes into five-fold rosettes that bloom and drift as the top layer turns and moves. Broad regions still agree while veins of mismatch run between them, all carrying the five-fold symmetry. The two share every finite patch yet never line up everywhere at once, which is what Penrose saw on his overhead projector."
      />
    </Sketch>
  );
}
