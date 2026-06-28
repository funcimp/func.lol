"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Sketch from "./Sketch";
import { PCOS, PSIN } from "../explore/lib/cap";
import { facesInViewport, GAMMA, type Rect } from "../explore/lib/pentagrid";
import { ribbonsForFamily } from "../explore/lib/ribbons";
import { suns } from "../explore/lib/motifs";
import type { RenderFace, Pt } from "../explore/lib/patch";

// "Patterns start to surface": on the SAME tiling (same gold/teal colours, never
// recoloured), reveal the structure hiding in it, one idea at a time.
//   ROSETTES — the five-petal suns (five thick rhombi at a vertex) glow where they sit;
//     the motif your eye catches first.
//   RIBBONS — one family of de Bruijn bands lights up by dimming everything else back, so
//     the band reads as a strip of REAL tiles, not a paint stripe; pick its direction.
// The Ammann bars (the straight lines idealising the ribbons) are a later addition once
// the exact construction is in hand.
//
// HONEST BY CONSTRUCTION. Tiles are always coloured by true type. Suns are real vertex
// motifs (explore/lib/motifs.ts) and ribbons are real de Bruijn bands
// (explore/lib/ribbons.ts), both bound by their tests. Nothing is recoloured; structure
// is shown only by glow overlays and by dimming, so the colour key never lies.
//
// Canvas: the harness drives render(t); t reveals the chosen pattern. Reduced motion
// mounts at t = 1, fully revealed.

const VB = 480;
const PAD = 16;
const VIEW_R = 7;
const FAMILIES = [0, 1, 2, 3, 4];

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
type Mode = "rosettes" | "ribbons";

type Scene = {
  faces: RenderFace[];
  toPx: (p: Pt) => [number, number];
  sunsPx: [number, number][];
  sunR: number;
  maxR: number;
  // per family: incident faces tagged with perpendicular position, and the sweep range
  byFamily: { face: RenderFace; perp: number }[][];
  famLo: number[];
  famHi: number[];
};

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

  const sunsPx = suns(faces).map(toPx);
  const byFamily: { face: RenderFace; perp: number }[][] = [];
  const famLo: number[] = [], famHi: number[] = [];
  for (const fam of FAMILIES) {
    const u: Pt = [PCOS[fam], PSIN[fam]];
    const list: { face: RenderFace; perp: number }[] = [];
    let lo = Infinity, hi = -Infinity;
    for (const r of ribbonsForFamily(faces, fam)) {
      for (const f of r.faces) {
        const perp = f.centroid[0] * u[0] + f.centroid[1] * u[1];
        lo = Math.min(lo, perp); hi = Math.max(hi, perp);
        list.push({ face: f, perp });
      }
    }
    byFamily.push(list); famLo.push(lo); famHi.push(hi);
  }
  return { faces, toPx, sunsPx, sunR: 1.6 * s, maxR, byFamily, famLo, famHi };
}

export default function EmergentPatterns() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({ thick: "#C89B3C", thin: "#3E6B7C", paper: "#0f0e0c", ink: "#ede9d8" });
  const dprRef = useRef(0);
  const lastTRef = useRef(1);
  const scene = useMemo(() => buildScene(), []);

  const [mode, setMode] = useState<Mode>("rosettes");
  const modeRef = useRef<Mode>("rosettes");
  const [family, setFamily] = useState(0);
  const familyRef = useRef(0);

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
      const traceFace = (ctx: CanvasRenderingContext2D, f: RenderFace) => {
        const pts = f.corners.map(scene.toPx);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
      };
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
      const fillFor = (f: RenderFace) => (f.type === "thick" ? thick : thin);
      ctx.clearRect(0, 0, VB, VB);
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, VB, VB);
      ctx.lineJoin = "round";

      const m = modeRef.current;
      const fam = familyRef.current;

      // per-tile opacity: in ribbons mode, family tiles light up (swept) over a dimmed
      // rest; everywhere else tiles are full. Colours are never changed, only dimmed.
      let revealU = 0;
      const band = 0.6;
      if (m === "ribbons") {
        revealU = scene.famLo[fam] - 0.6 + t * (scene.famHi[fam] - scene.famLo[fam] + 1.4);
      }
      for (const f of scene.faces) {
        let a = 0.9;
        if (m === "ribbons") {
          const incident = f.j === fam || f.k === fam;
          if (incident) {
            // soft sweep edge for the lit band tiles
            const u: Pt = [PCOS[fam], PSIN[fam]];
            const perp = f.centroid[0] * u[0] + f.centroid[1] * u[1];
            a = 0.14 + 0.78 * clamp01((revealU - perp) / band);
          } else {
            a = 0.12;
          }
        }
        traceFace(ctx, f);
        ctx.globalAlpha = a;
        ctx.fillStyle = fillFor(f);
        ctx.fill();
        ctx.globalAlpha = a * 0.6;
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = ink;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // rosettes: soft halos on the suns, revealed from the centre outward
      if (m === "rosettes") {
        const front = t * (scene.maxR + 1);
        for (let i = 0; i < scene.sunsPx.length; i++) {
          const [sx, sy] = scene.sunsPx[i];
          // distance of this sun from frame centre (in data units ~ via px / scale not
          // needed; use px distance scaled): reveal by px distance
          const rPx = Math.hypot(sx - VB / 2, sy - VB / 2);
          const aGlow = clamp01((front * (scene.sunR / 1.6) - rPx + scene.sunR) / scene.sunR);
          if (aGlow <= 0.01) continue;
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, scene.sunR);
          g.addColorStop(0, ink);
          g.addColorStop(1, "transparent");
          ctx.globalAlpha = 0.32 * aGlow;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(sx, sy, scene.sunR, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    },
    [scene, refreshColors],
  );

  const pickMode = useCallback((mo: Mode) => { modeRef.current = mo; setMode(mo); render(lastTRef.current); }, [render]);
  const pickFamily = useCallback((f: number) => { familyRef.current = f; setFamily(f); render(lastTRef.current); }, [render]);

  useEffect(() => {
    const observer = new MutationObserver(() => { refreshColors(); render(lastTRef.current); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [refreshColors, render]);

  const modeBtn = (mo: Mode) =>
    `font-mono text-[11px] lowercase px-2.5 py-1 rounded-full transition-colors ${mode === mo ? "bg-ink text-paper" : "opacity-60 hover:opacity-100"}`;

  return (
    <Sketch
      label="sketch 03 · patterns start to surface"
      animation={{ duration: 6000, render, slider: { label: "reveal" } }}
    >
      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "auto", aspectRatio: "1 / 1" }}
          className="block w-full bg-paper"
          role="img"
          aria-label="The same Penrose tiling, gold thick and teal thin, with hidden patterns revealed on top without recolouring the tiles. Rosettes mode glows the suns, the five-petal flowers where five thick rhombi meet. Ribbons mode dims the tiling back and lights up one family of de Bruijn bands, long strips of real tiles running across the patch in one of five directions, chosen with the picker. These are emergent patterns hidden in any Penrose tiling."
        />
        <div className="pointer-events-auto absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-ink/40 bg-paper/70 px-1.5 py-0.5 backdrop-blur-sm">
          <button type="button" onClick={() => pickMode("rosettes")} aria-pressed={mode === "rosettes"} className={modeBtn("rosettes")}>rosettes</button>
          <button type="button" onClick={() => pickMode("ribbons")} aria-pressed={mode === "ribbons"} className={modeBtn("ribbons")}>ribbons</button>
          {mode === "ribbons" && (
            <span className="ml-1 flex items-center gap-1 border-l border-ink/30 pl-2">
              {FAMILIES.map((fam) => {
                const ang = ((90 + 72 * fam) * Math.PI) / 180;
                const dx = Math.cos(ang) * 6, dy = -Math.sin(ang) * 6;
                return (
                  <button key={fam} type="button" onClick={() => pickFamily(fam)} aria-label={`band direction ${fam + 1} of 5`} aria-pressed={family === fam} className="grid h-5 w-5 place-items-center rounded-sm hover:bg-ink/10">
                    <svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true">
                      <line x1={-dx} y1={-dy} x2={dx} y2={dy} stroke="var(--color-ink)" strokeWidth={family === fam ? 2.4 : 1.2} strokeOpacity={family === fam ? 1 : 0.4} strokeLinecap="round" />
                    </svg>
                  </button>
                );
              })}
            </span>
          )}
        </div>
      </div>
      <div className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5]">
        <p>
          The same tiling, same colours. Now look for the patterns inside it.{" "}
          <strong>Rosettes</strong> are the five-petal suns, where five thick tiles meet,
          the motif the eye catches first. <strong>Ribbons</strong> are long bands of
          tiles running clear across the plane in five directions, lit here by dimming the
          rest so each band stays real tiles, not paint.
        </p>
        <p className="mt-2 opacity-70">
          Every tile sits on exactly two ribbons, one per axis, and the bands never line
          up the same way twice. They are the skeleton the famous Ammann bars, the straight
          lines hidden in any Penrose tiling, idealise.
        </p>
      </div>
    </Sketch>
  );
}
