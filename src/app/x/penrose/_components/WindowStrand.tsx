"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import {
  buildWindowStrand,
  type PolyPt,
  type WindowStrand as WS,
} from "./lib/windowStrand";

// "The dead-ends, seen in the window": the spine sketch that ties the hand-tiling
// dead-ends (02/03) to cut and project (05). Left, physical space: a correct patch is
// laid tile by tile, then a tempting tile is placed that FITS with zero overlap. Right,
// window-centre space: the set of window centres still consistent with the patch, which
// shrinks as each correct tile lands but never empties (it always holds the true
// window). When the tempting tile is placed, that region collapses to nothing: no window
// accepts the patch, so it can never be completed. A piece fits, and still strands you.
//
// HONEST BY CONSTRUCTION. Everything is from lib/windowStrand.ts (and its test): the
// consistent-window region is the intersection of each placed vertex's accept pentagon
// (the algebraic inverse of cap.ts inWindow), the correct tiles are real faces, and the
// fatal tile is verified to fit (no real overlap), to not be a face, and to take the
// non-empty region to empty. The culprit corner's accept pentagon, drawn on the right,
// excludes the whole region: its shadow can share no window with the patch.
//
// Canvas: the harness drives render(t); t lays the patch, then places the fatal tile and
// collapses the window. Reduced motion mounts at t = 1, the stranded end state.

const VB_W = 720;
const VB_H = 392;
const PANEL = 320;
const TOP = 52;
const X0L = 24;
const X0R = VB_W - 24 - PANEL;
const PADP = 18;

const RED = "#d24a3d"; // the dead-end red, shared with the hand-tiling sketches

const BUILD_END = 0.64;
const WRONG_END = 0.84;

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (e0: number, e1: number, x: number): number => {
  const u = clamp01((x - e0) / (e1 - e0));
  return u * u * (3 - 2 * u);
};

type Fit = (p: PolyPt) => [number, number];
function makeFit(b: { minX: number; minY: number; maxX: number; maxY: number }, x0: number): Fit {
  const w = b.maxX - b.minX, h = b.maxY - b.minY;
  const s = (PANEL - 2 * PADP) / Math.max(w, h);
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  return (p) => [x0 + PANEL / 2 + (p[0] - cx) * s, TOP + PANEL / 2 - (p[1] - cy) * s];
}

function bboxOf(pts: PolyPt[], pad: number) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: PolyPt[], fit: Fit) {
  if (pts.length === 0) return;
  ctx.beginPath();
  const [x0, y0] = fit(pts[0]);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < pts.length; i++) { const [x, y] = fit(pts[i]); ctx.lineTo(x, y); }
  ctx.closePath();
}

// Scale a polygon toward its centroid (for the collapse animation).
function scaleToward(pts: PolyPt[], f: number): PolyPt[] {
  if (pts.length === 0) return pts;
  let cx = 0, cy = 0;
  for (const [x, y] of pts) { cx += x; cy += y; }
  cx /= pts.length; cy /= pts.length;
  return pts.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f] as PolyPt);
}

function caption(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  align: CanvasTextAlign,
  alpha = 1,
  size = 11,
  bold = false,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `${bold ? "600 " : ""}${size}px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
  ctx.restore();
}

export default function WindowStrand() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({ thick: "#C89B3C", thin: "#3E6B7C", paper: "#0f0e0c", ink: "#ede9d8" });
  const dprRef = useRef(0);
  const lastTRef = useRef(1);

  const ws = useMemo<WS>(() => buildWindowStrand(), []);
  const fitL = useMemo(() => makeFit(ws.physBounds, X0L), [ws]);
  const fitR = useMemo(() => makeFit(bboxOf(ws.build[0].region, 0.35), X0R), [ws]);

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
        canvas.width = VB_W * dpr;
        canvas.height = VB_H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        refreshColors();
      }
      const { thick, thin, ink, paper } = colorsRef.current;
      const colorFor = (ty: "thick" | "thin") => (ty === "thick" ? thick : thin);
      const B = ws.build.length;

      ctx.clearRect(0, 0, VB_W, VB_H);
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, VB_W, VB_H);

      // phase + counts
      const buildProg = clamp01(t / BUILD_END);
      const fb = buildProg * B;
      const placed = Math.min(B, Math.floor(fb));
      const fadingFrac = fb - placed;
      const wp = clamp01((t - BUILD_END) / (WRONG_END - BUILD_END));
      const stranded = t >= WRONG_END;
      const wrongAlpha = smooth(0, 0.55, wp);

      // panel frames + titles
      ctx.save();
      ctx.globalAlpha = 0.18; ctx.strokeStyle = ink; ctx.lineWidth = 1;
      ctx.strokeRect(X0L, TOP, PANEL, PANEL);
      ctx.strokeRect(X0R, TOP, PANEL, PANEL);
      ctx.restore();
      caption(ctx, "tiling by hand", X0L, 42, ink, "left", 0.7);
      caption(ctx, "windows still consistent", X0R + PANEL, 42, ink, "right", 0.7);

      // ---- LEFT: the physical patch ----
      ctx.save();
      ctx.beginPath(); ctx.rect(X0L, TOP, PANEL, PANEL); ctx.clip();
      ctx.lineJoin = "round";
      for (let i = 0; i < B; i++) {
        const f = ws.build[i];
        let a = 0;
        if (i < placed) a = 1;
        else if (i === placed && !stranded && t < BUILD_END) a = fadingFrac;
        else if (t >= BUILD_END) a = 1; // all correct tiles present during/after the move
        if (a <= 0.01) continue;
        fillPoly(ctx, f.face.phys, fitL);
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = colorFor(f.face.type);
        ctx.fill();
        ctx.globalAlpha = a * 0.55;
        ctx.lineWidth = 0.8; ctx.strokeStyle = ink; ctx.stroke();
      }
      // the fatal tile
      if (wrongAlpha > 0.01) {
        fillPoly(ctx, ws.wrong.face.phys, fitL);
        ctx.globalAlpha = wrongAlpha * 0.9;
        ctx.fillStyle = colorFor(ws.wrong.face.type);
        ctx.fill();
        ctx.globalAlpha = wrongAlpha;
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = stranded ? RED : ink;
        ctx.setLineDash(stranded ? [] : [5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();

      // ---- RIGHT: window-centre space ----
      ctx.save();
      ctx.beginPath(); ctx.rect(X0R, TOP, PANEL, PANEL); ctx.clip();

      // the true window centre w0
      const w0 = fitR(ws.center);
      ctx.save();
      ctx.globalAlpha = 0.7; ctx.strokeStyle = ink; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(w0[0] - 5, w0[1]); ctx.lineTo(w0[0] + 5, w0[1]);
      ctx.moveTo(w0[0], w0[1] - 5); ctx.lineTo(w0[0], w0[1] + 5); ctx.stroke();
      ctx.restore();

      // the consistent-window region
      const regionStep = placed >= 1 ? ws.build[placed - 1].region : null;
      if (!stranded && t < BUILD_END && regionStep) {
        fillPoly(ctx, regionStep, fitR);
        ctx.globalAlpha = 0.22; ctx.fillStyle = thin; ctx.fill();
        ctx.globalAlpha = 0.85; ctx.lineWidth = 1.4; ctx.strokeStyle = thin; ctx.stroke();
      } else if (t >= BUILD_END) {
        // the move: culprit pentagon clips the region away to nothing
        const collapse = smooth(0.25, 1, wp);
        ctx.save();
        ctx.globalAlpha = wrongAlpha * 0.7;
        ctx.strokeStyle = RED; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
        fillPoly(ctx, ws.wrong.accept, fitR); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        const shrunk = scaleToward(ws.wrong.regionBefore, 1 - collapse);
        if (collapse < 0.999) {
          fillPoly(ctx, shrunk, fitR);
          const red = collapse;
          ctx.globalAlpha = 0.22 + 0.3 * red;
          ctx.fillStyle = red > 0.05 ? RED : thin;
          ctx.fill();
          ctx.globalAlpha = 0.85; ctx.lineWidth = 1.4;
          ctx.strokeStyle = red > 0.05 ? RED : thin; ctx.stroke();
        }
        // the culprit shadow point
        const cs = fitR(ws.wrong.culpritInternal);
        ctx.save();
        ctx.globalAlpha = wrongAlpha; ctx.fillStyle = RED;
        ctx.beginPath(); ctx.arc(cs[0], cs[1], 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // captions under the panels
      if (!stranded && t < BUILD_END) {
        caption(ctx, "this piece fits, no overlap", X0L + PANEL / 2, VB_H - 14, ink, "center", 0.65 * smooth(0, 0.3, buildProg));
        caption(ctx, "each tile narrows the windows that still work", X0R + PANEL / 2, VB_H - 14, ink, "center", 0.7);
      } else {
        caption(ctx, "the tempting tile fits, and strands you", X0L + PANEL / 2, VB_H - 14, stranded ? RED : ink, "center", Math.max(0.7, wrongAlpha));
        caption(ctx, stranded ? "no window left — dead end" : "the last windows vanish", X0R + PANEL / 2, VB_H - 14, stranded ? RED : ink, "center", Math.max(0.7, wrongAlpha));
      }
    },
    [ws, fitL, fitR, refreshColors],
  );

  useEffect(() => {
    const observer = new MutationObserver(() => { refreshColors(); render(lastTRef.current); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [refreshColors, render]);

  return (
    <Sketch
      label="sketch 08 · the dead-ends, seen in the window"
      animation={{ duration: 13000, render, slider: { label: "place" } }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "auto", aspectRatio: `${VB_W} / ${VB_H}` }}
        className="block w-full bg-paper"
        role="img"
        aria-label="Two panels tying the hand-tiling dead-ends to cut and project. Left, physical space: a correct Penrose patch is laid tile by tile, then a tempting tile is placed that fits with zero overlap. Right, window-centre space: the set of window centres still consistent with the patch, which shrinks as each correct tile is placed but never empties, always holding the tiling's true window. When the tempting tile is placed, that region collapses to nothing: no window accepts the patch, so it can never be completed. The culprit corner's acceptance pentagon, drawn in red, excludes the whole region. A piece fits, and still strands you, and the reason is visible in the window."
      />
      <div className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5]">
        <p>
          Each tile you place is a constraint on where a single consistent window could
          sit. Lay correct tiles and that region shrinks but never empties: it always
          holds the tiling&#39;s true window. The tempting tile fits with no overlap, yet
          its corner&#39;s shadow lands where no surviving window can hold it, so the
          region collapses to nothing.
        </p>
        <p className="mt-2 opacity-70">
          That is the dead-end of sketches 03 and 04, seen from the inside. Tiling by
          hand gropes for a consistent window one move at a time, and a move can leave
          none. Cut and project picks the window first and tests every tile against it,
          so the region is never in doubt and the plane never strands.
        </p>
      </div>
    </Sketch>
  );
}
