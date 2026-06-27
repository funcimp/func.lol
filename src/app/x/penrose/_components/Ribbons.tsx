"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Sketch from "./Sketch";
import { PCOS, PSIN } from "../explore/lib/cap";
import { facesInViewport, GAMMA, type Rect } from "../explore/lib/pentagrid";
import { ribbonsForFamily, type Ribbon } from "../explore/lib/ribbons";
import type { RenderFace, Pt } from "../explore/lib/patch";

// "The bands hidden in the tiling": lay the two rhombi into a real Penrose patch, and a
// higher-order pattern appears. The tiling is threaded by five families of BANDS, one per
// edge direction, each a long strip of tiles running clear across the plane. Pick a
// direction and its bands light up; the famous Ammann bars are the perfectly straight
// lines that idealize these bands.
//
// HONEST BY CONSTRUCTION. The bands are de Bruijn ribbons computed from the engine
// (explore/lib/ribbons.ts and its test): a tile sits on the family-f line at level
// coord[f], so the tiles sharing one line are one band. Every tile belongs to exactly two
// bands (one per axis); each band spans the patch and is about one tile thick. Their
// spacing is quasiperiodic (never exactly repeating), which is why no two bands line up
// the same way twice. Nothing here is decorative: the lit tiles are the real ribbon.
//
// Canvas: the harness drives render(t); t sweeps the chosen family's bands into view.
// Reduced motion mounts at t = 1, all of that family's bands shown.

const VB = 480;
const PAD = 16;
const VIEW_R = 7; // patch half-extent fed to the enumerator
const FAMILIES = [0, 1, 2, 3, 4];

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

type Scene = {
  faces: RenderFace[];
  ribbonsByFamily: Ribbon[][]; // index by family 0..4
  toPx: (p: Pt) => [number, number];
};

function buildScene(): Scene {
  const view: Rect = { minX: -VIEW_R, minY: -VIEW_R, maxX: VIEW_R, maxY: VIEW_R };
  const faces = facesInViewport(view, GAMMA);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of faces) for (const [x, y] of f.corners) {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const s = (VB - 2 * PAD) / Math.max(maxX - minX, maxY - minY);
  const toPx = (p: Pt): [number, number] => [VB / 2 + (p[0] - cx) * s, VB / 2 - (p[1] - cy) * s];
  const ribbonsByFamily = FAMILIES.map((fam) => ribbonsForFamily(faces, fam));
  return { faces, ribbonsByFamily, toPx };
}

export default function Ribbons() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({ thick: "#C89B3C", thin: "#3E6B7C", paper: "#0f0e0c", ink: "#ede9d8" });
  const dprRef = useRef(0);
  const lastTRef = useRef(1);

  const scene = useMemo(() => buildScene(), []);
  const [family, setFamily] = useState(0);
  const familyRef = useRef(0);

  // Per-family band geometry: each ribbon's perpendicular position (along the family
  // normal), for the sweep, plus the band's run direction for the picker.
  const bands = useMemo(() => {
    return FAMILIES.map((fam) => {
      const u: Pt = [PCOS[fam], PSIN[fam]]; // family-line normal; ribbons sit at constant p·u
      const ribs = scene.ribbonsByFamily[fam];
      let lo = Infinity, hi = -Infinity;
      const perp = ribs.map((r) => {
        let s = 0;
        for (const f of r.faces) s += f.centroid[0] * u[0] + f.centroid[1] * u[1];
        const p = s / r.faces.length;
        lo = Math.min(lo, p); hi = Math.max(hi, p);
        return p;
      });
      return { ribs, perp, lo, hi };
    });
  }, [scene]);

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
      const { thick, paper, ink } = colorsRef.current;
      ctx.clearRect(0, 0, VB, VB);
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, VB, VB);

      const trace = (f: RenderFace) => {
        const pts = f.corners.map(scene.toPx);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
      };

      // The plain tiling underneath: faint line work, so the bands read against it.
      ctx.save();
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 0.6;
      ctx.lineJoin = "round";
      for (const f of scene.faces) { trace(f); ctx.stroke(); }
      ctx.restore();

      // The chosen family's bands, swept in along the family normal.
      const fam = familyRef.current;
      const b = bands[fam];
      const sweep = b.lo - 0.5 + t * (b.hi - b.lo + 1.2);
      const BAND = 0.6;
      for (let i = 0; i < b.ribs.length; i++) {
        const a = clamp01((sweep - b.perp[i]) / BAND);
        if (a <= 0.01) continue;
        for (const f of b.ribs[i].faces) {
          trace(f);
          ctx.globalAlpha = a * 0.92;
          ctx.fillStyle = thick;
          ctx.fill();
          ctx.globalAlpha = a * 0.6;
          ctx.lineWidth = 0.7;
          ctx.strokeStyle = ink;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    },
    [scene, bands, refreshColors],
  );

  const pick = useCallback((fam: number) => {
    familyRef.current = fam;
    setFamily(fam);
    render(lastTRef.current);
  }, [render]);

  useEffect(() => {
    const observer = new MutationObserver(() => { refreshColors(); render(lastTRef.current); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [refreshColors, render]);

  const bandCount = bands[family].ribs.length;

  return (
    <Sketch
      label="sketch 02 · the bands hidden in the tiling"
      animation={{ duration: 6000, render, slider: { label: "reveal" } }}
    >
      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "auto", aspectRatio: "1 / 1" }}
          className="block w-full bg-paper"
          role="img"
          aria-label={`A real Penrose patch of the two rhombi, drawn as faint line work. Highlighted on top is one of five families of bands hidden in the tiling: a de Bruijn ribbon family, long strips of tiles each running clear across the patch in one of the five edge directions. The control picks the direction; its ${bandCount} bands sweep into view. Every tile belongs to exactly two such bands, one per axis, and the bands are spaced quasiperiodically, never exactly repeating. These bands are the structure the famous Ammann bars, the straight lines threading a Penrose tiling, idealize.`}
        />
        {/* direction picker: each pip is a short line at that family's band angle */}
        <div className="pointer-events-auto absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-ink/40 bg-paper/70 px-3 py-1 backdrop-blur-sm">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.12em] opacity-55">direction</span>
          {FAMILIES.map((fam) => {
            const ang = ((90 + 72 * fam) * Math.PI) / 180; // the band runs along the family normal
            const dx = Math.cos(ang) * 6, dy = -Math.sin(ang) * 6;
            return (
              <button
                key={fam}
                type="button"
                onClick={() => pick(fam)}
                aria-label={`band direction ${fam + 1} of 5`}
                aria-pressed={family === fam}
                className="grid h-5 w-5 place-items-center rounded-sm hover:bg-ink/10"
              >
                <svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true">
                  <line
                    x1={-dx} y1={-dy} x2={dx} y2={dy}
                    stroke={family === fam ? "var(--color-penrose-thick)" : "var(--color-ink)"}
                    strokeWidth={family === fam ? 2.4 : 1.2}
                    strokeOpacity={family === fam ? 1 : 0.5}
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5]">
        <p>
          Lay the two tiles into a tiling and a higher-order pattern appears: the plane is
          threaded by five families of <strong>bands</strong>, one per edge direction, each
          a long strip of tiles running clear across it. Pick a direction above to light its
          bands up.
        </p>
        <p className="mt-2 opacity-70">
          Every tile sits on exactly two of these bands, one per axis, and the spacing
          never exactly repeats. These are the de Bruijn ribbons; the famous Ammann bars
          are the perfectly straight lines that idealize them, spaced in the same kind of
          long/short rhythm as the strip later on.
        </p>
      </div>
    </Sketch>
  );
}
