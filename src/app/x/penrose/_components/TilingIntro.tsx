"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Sketch from "./Sketch";
import { facesInViewport, GAMMA, type Rect } from "../explore/lib/pentagrid";
import type { RenderFace, Pt } from "../explore/lib/patch";

// "Lay them into a tiling": the gentle on-ramp. Drop the two rhombi together and they
// cover the plane with no gaps and no repeat. Nothing deeper yet, no five-fold structure,
// no bands. Just the tiling settling in, gold for thick, teal for thin, the colours used
// everywhere after. Hover a tile to hear which it is.
//
// HONEST BY CONSTRUCTION. A real patch from facesInViewport at the pinned window centre,
// each tile coloured by its true type. Nothing is recoloured or decorated.
//
// Canvas: the harness drives render(t); the patch settles in from the centre outward.
// Reduced motion mounts at t = 1, the full patch.

const VB = 480;
const PAD = 16;
const VIEW_R = 7;
// The resting frame (motion viewers sit at t = 0) already shows the central cluster of
// this radius, so the sketch invites a play press instead of starting blank; play
// settles the rest of the patch in from there outward.
const SEED_R = 2.6;

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function pointInQuad(x: number, y: number, q: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const [xi, yi] = q[i];
    const [xj, yj] = q[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

type Scene = { faces: RenderFace[]; toPx: (p: Pt) => [number, number]; maxR: number };
function buildScene(): Scene {
  const view: Rect = { minX: -VIEW_R, minY: -VIEW_R, maxX: VIEW_R, maxY: VIEW_R };
  const faces = facesInViewport(view, GAMMA);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, maxR = 0;
  for (const f of faces) {
    for (const [x, y] of f.corners) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    maxR = Math.max(maxR, Math.hypot(f.centroid[0], f.centroid[1]));
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const s = (VB - 2 * PAD) / Math.max(maxX - minX, maxY - minY);
  const toPx = (p: Pt): [number, number] => [VB / 2 + (p[0] - cx) * s, VB / 2 - (p[1] - cy) * s];
  return { faces, toPx, maxR };
}

export default function TilingIntro() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({ thick: "#C89B3C", thin: "#3E6B7C", paper: "#0f0e0c", ink: "#ede9d8" });
  const dprRef = useRef(0);
  const lastTRef = useRef(1);
  const hoverRef = useRef<RenderFace | null>(null);
  const [hoverType, setHoverType] = useState<"thick" | "thin" | null>(null);

  const scene = useMemo(() => buildScene(), []);

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
      lastTRef.current = t;
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
      const { thick, thin, paper, ink } = colorsRef.current;
      ctx.clearRect(0, 0, VB, VB);
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, VB, VB);
      ctx.lineJoin = "round";

      const front = SEED_R + t * (scene.maxR + 1 - SEED_R); // settle in from the centre outward
      const hov = hoverRef.current;
      for (const f of scene.faces) {
        const r = Math.hypot(f.centroid[0], f.centroid[1]);
        const a = clamp01((front - r) / 1.2);
        if (a <= 0.01) continue;
        const pts = f.corners.map(scene.toPx);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        const lit = hov !== null && hov.key === f.key;
        ctx.globalAlpha = a * (lit ? 1 : 0.9);
        ctx.fillStyle = f.type === "thick" ? thick : thin;
        ctx.fill();
        ctx.globalAlpha = a * (lit ? 1 : 0.5);
        ctx.lineWidth = lit ? 2 : 0.7;
        ctx.strokeStyle = ink;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    [scene, refreshColors],
  );

  const onHover = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * VB;
      const y = ((e.clientY - rect.top) / rect.height) * VB;
      let found: RenderFace | null = null;
      for (const f of scene.faces) {
        if (pointInQuad(x, y, f.corners.map(scene.toPx))) { found = f; break; }
      }
      if ((found?.key ?? null) !== (hoverRef.current?.key ?? null)) {
        hoverRef.current = found;
        setHoverType(found ? found.type : null);
        render(lastTRef.current);
      }
    },
    [scene, render],
  );
  const onLeave = useCallback(() => {
    if (hoverRef.current) { hoverRef.current = null; setHoverType(null); render(lastTRef.current); }
  }, [render]);

  useEffect(() => {
    const observer = new MutationObserver(() => { refreshColors(); render(lastTRef.current); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [refreshColors, render]);

  return (
    <Sketch
      label="sketch 02 · lay them into a tiling"
      animation={{ duration: 5000, render, slider: { label: "settle" } }}
    >
      <canvas
        ref={canvasRef}
        onPointerMove={onHover}
        onPointerLeave={onLeave}
        style={{ width: "100%", height: "auto", aspectRatio: "1 / 1", cursor: "crosshair", touchAction: "none" }}
        className="block w-full bg-paper"
        role="img"
        aria-label="A real Penrose tiling: a patch of the two rhombi, gold for the thick tile and teal for the thin one, settling in from the centre outward. Two shapes, same edge length, cover the plane with no gaps and no repeating pattern. Hovering a tile names it thick or thin."
      />
      <div className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3" style={{ backgroundColor: "var(--color-penrose-thick)" }} /> thick
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3" style={{ backgroundColor: "var(--color-penrose-thin)" }} /> thin
          </span>
          <span aria-live="polite" className="opacity-70">
            {hoverType ? `hovering a ${hoverType} tile` : "hover a tile"}
          </span>
        </div>
        <p className="mt-2 opacity-70">
          Two shapes, dropped together, cover the plane with no gaps. But the pattern
          never repeats: slide this tiling any distance in any direction and it never
          lands back on itself. That is what makes it a Penrose tiling.
        </p>
      </div>
    </Sketch>
  );
}
