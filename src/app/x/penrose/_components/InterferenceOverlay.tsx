"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import { buildOverlay, type Overlay, type Pt } from "./lib/overlay";

// "Slide one over another": the spine's section-7 sketch, Penrose's overhead-
// projector demo, rebuilt to push and spin. Two real Penrose tilings are drawn as
// line work over a large plane that runs well off screen, the bottom in ink and the
// top in a translucent accent. Spin the top layer a fifth of a turn, or drag it, and
// the places where the two disagree organize into five-fold rosettes that bloom and
// drift. Zoomed out, those rosettes read at scale.
//
// HONEST BY CONSTRUCTION. Both layers are the SAME real enumerator patch
// (lib/overlay.ts and its test). The interference is emergent: nothing is tinted, the
// moiré is just two real tilings overlapping. Each layer is rasterised ONCE to an
// offscreen canvas, then composited every frame, the top one rotated and translated.
// A rigid rotation of the bitmap is the same as rotating the tiling, so this is
// faithful, and it is literally Penrose's two transparencies on a projector. Two
// drawImage calls per frame instead of stroking thousands of tiles, so spin and drag
// stay smooth on the large plane.
//
// The harness drives render(t) for the spin (one fifth, looping); pointer drag slides
// the top layer. Theme colours are read live; the offscreen layers rebuild on a theme
// or device-pixel-ratio change.

const VB = 560;
const MARGIN = 10;
// Zoomed far out over a large generated plane, so the five-fold interference rosettes
// read at scale and dragging never runs out of tiling.
const VIEW_HALF = 42;
const GEN_HALF = 75;
// The tilings carry five-fold symmetry, so a full spin just repeats; one fifth of a
// turn is the whole story. The slider turns the top layer across [0, 72 deg].
const TURN_MAX = (2 * Math.PI) / 5;
const OFFSET_MAX = 12; // how far the top layer may be dragged, in tile-edge units

const SCALE = (VB - 2 * MARGIN) / (2 * VIEW_HALF);
// Offscreen half-extents, in data units. The bottom never moves, so it only needs the
// frame. The top is rotated about the centre and dragged, so it needs the frame's
// diagonal plus the drag so it still covers the frame at any angle.
const RAD_BOTTOM = VIEW_HALF + 3;
const RAD_TOP = VIEW_HALF * Math.SQRT2 + OFFSET_MAX + 2;

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };
const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

// Rasterise one tiling layer to an offscreen canvas, once. Faces are culled to a data
// radius and stroked in offscreen pixels; the per-frame compositor maps the bitmap back
// into the view. Line width is scaled by dpr so the composited result matches a direct
// stroke at `width` CSS px.
function buildLayer(
  faces: Overlay["a"],
  rad: number,
  color: string,
  width: number,
  alpha: number,
  dpr: number,
): HTMLCanvasElement {
  const s = SCALE * dpr;
  const px = Math.ceil(2 * rad * s);
  const off = document.createElement("canvas");
  off.width = px;
  off.height = px;
  const octx = off.getContext("2d")!;
  const c = px / 2;
  octx.globalAlpha = alpha;
  octx.strokeStyle = color;
  octx.lineWidth = width * dpr;
  octx.lineJoin = "round";
  octx.beginPath();
  for (const f of faces) {
    if (Math.abs(f.centroid[0]) > rad || Math.abs(f.centroid[1]) > rad) continue;
    const cor = f.corners;
    octx.moveTo(c + cor[0][0] * s, c - cor[0][1] * s);
    for (let i = 1; i < cor.length; i++) octx.lineTo(c + cor[i][0] * s, c - cor[i][1] * s);
    octx.closePath();
  }
  octx.stroke();
  return off;
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

type Cache = { dpr: number; ink: string; thick: string; bottom: HTMLCanvasElement; top: HTMLCanvasElement };

export default function InterferenceOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({
    thick: "#C89B3C",
    thin: "#3E6B7C",
    paper: "#0f0e0c",
    ink: "#ede9d8",
  });
  const dprRef = useRef(0);
  const cacheRef = useRef<Cache | null>(null);
  const overlay = useMemo(() => buildOverlay(GEN_HALF), []);

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

  // Rebuild the two offscreen layers if the dpr or the relevant theme colours changed.
  const ensureCache = useCallback((dpr: number) => {
    const { ink, thick } = colorsRef.current;
    const c = cacheRef.current;
    if (c && c.dpr === dpr && c.ink === ink && c.thick === thick) return c;
    const next: Cache = {
      dpr,
      ink,
      thick,
      bottom: buildLayer(overlay.a, RAD_BOTTOM, ink, 0.5, 0.3, dpr),
      top: buildLayer(overlay.b, RAD_TOP, thick, 0.7, 0.85, dpr),
    };
    cacheRef.current = next;
    return next;
  }, [overlay]);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    if (dpr !== dprRef.current) {
      dprRef.current = dpr;
      canvas.width = VB * dpr;
      canvas.height = VB * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      refreshColors();
    }
    const { paper, ink } = colorsRef.current;
    const cache = ensureCache(dpr);
    const twist = twistRef.current;
    const [ox, oy] = offsetRef.current;

    ctx.clearRect(0, 0, VB, VB);
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, VB, VB);

    // BOTTOM: the fixed tiling bitmap, mapped straight into the view.
    const rb = RAD_BOTTOM * SCALE;
    ctx.drawImage(cache.bottom, VB / 2 - rb, VB / 2 - rb, 2 * rb, 2 * rb);

    // TOP: the same tiling, spun about the centre and dragged. toPx(rotate(twist)*p +
    // offset) reduces to: translate to centre + offset, rotate by -twist (canvas y is
    // down), then draw the bitmap centred. One composite, no per-tile work.
    const rt = RAD_TOP * SCALE;
    ctx.save();
    ctx.translate(VB / 2 + ox * SCALE, VB / 2 - oy * SCALE);
    ctx.rotate(-twist);
    ctx.drawImage(cache.top, -rt, -rt, 2 * rt, 2 * rt);
    ctx.restore();

    caption(ctx, "drag to slide the top layer · turn it up to a fifth", VB / 2, VB - 14, ink, 0.7);
  }, [ensureCache, refreshColors]);

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
      cacheRef.current = null; // colours changed; rebuild the layers
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
