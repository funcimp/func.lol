"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import { buildPatch, type SketchTile } from "./lib/cutProject";
import { DIRS, pickAddressTile, type AddressTile } from "./lib/address";

// "Every tile knows its address": the spine's section-8 sketch. The address is the
// tile's ℤ⁵ coordinate, five integers, and each integer counts steps along one of
// five fixed directions (the tile's own edge directions). Walking those steps from
// the origin lands exactly on the tile's corner, so the address is a path you can
// walk, not a label stuck on after.
//
// The reveal: first the blank walk, just the five direction rays and the path
// stepping out to the tile. Then the rest of the tiling fades in around it, so you
// see where that one address sits in the whole grid, the path still drawn on top.
//
// Bound to address.ts (and address.test.ts): the directions, the walk, and the tile
// are real engine output, and the walk provably ends at physical(coord). The patch
// that fades in is the same cut-and-project patch the explorer paints.
//
// Canvas: the harness drives render(t); t walks the path then fades in the tiling.

const VB_W = 620;
const VB_H = 540;
const PAD = 30;

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };
type Pt = readonly [number, number];

function makeFit(tile: AddressTile, patch: SketchTile[]) {
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  const note = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const t of patch) for (const [x, y] of t.physical) note(x, y);
  for (const [x, y] of tile.path) note(x, y);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY) / 2 + 0.4;
  const s = Math.min(
    (VB_W - 2 * PAD) / (2 * half),
    (VB_H - 2 * PAD - 46) / (2 * half),
  );
  return (p: Pt): [number, number] => [
    VB_W / 2 + (p[0] - cx) * s,
    VB_H / 2 + 22 - (p[1] - cy) * s, // leave room for the address row up top
  ];
}

type Range = { start: number; end: number; count: number } | null;
function digitRanges(tile: AddressTile): Range[] {
  const ranges: Range[] = [null, null, null, null, null];
  let acc = 0;
  for (const g of tile.groups) {
    const len = Math.abs(g.count);
    ranges[g.l] = { start: acc, end: acc + len, count: g.count };
    acc += len;
  }
  return ranges;
}

function caption(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  ink: string,
  alpha: number,
) {
  if (alpha <= 0.001) return;
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

function arrowHead(
  ctx: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  ink: string,
) {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const len = 9;
  ctx.save();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(to[0], to[1]);
  ctx.lineTo(to[0] - len * Math.cos(ang - 0.4), to[1] - len * Math.sin(ang - 0.4));
  ctx.lineTo(to[0] - len * Math.cos(ang + 0.4), to[1] - len * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paint(
  ctx: CanvasRenderingContext2D,
  t: number,
  tile: AddressTile,
  patch: SketchTile[],
  ranges: Range[],
  colors: Colors,
) {
  const { thick, thin, paper, ink } = colors;
  const fit = makeFit(tile, patch);
  const T = tile.path.length - 1;

  // Phase 1: walk the blank path. Phase 2: the tiling fades in around it.
  const walkP = Math.max(0, Math.min(1, t / 0.58));
  const shown = Math.max(0, Math.min(T, Math.round(walkP * T)));
  const fade = Math.max(0, Math.min(1, (t - 0.62) / 0.38));

  ctx.clearRect(0, 0, VB_W, VB_H);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, VB_W, VB_H);

  // The surrounding tiling, faded in.
  if (fade > 0) {
    for (const tl of patch) {
      ctx.beginPath();
      tl.physical.forEach((c, i) => {
        const [x, y] = fit(c);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.save();
      ctx.globalAlpha = fade * 0.8;
      ctx.fillStyle = tl.type === "thick" ? thick : thin;
      ctx.fill();
      ctx.globalAlpha = fade * 0.5;
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = ink;
      ctx.stroke();
      ctx.restore();
    }
  }

  // The target tile, highlighted, sitting where the walk lands.
  if (fade > 0) {
    ctx.beginPath();
    tile.corners.forEach((c, i) => {
      const [x, y] = fit(c);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = tile.type === "thick" ? thick : thin;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.restore();
  }

  // The five direction rays from the origin, fading back as the tiling arrives.
  const o = fit([0, 0]);
  const rayA = 0.32 * (1 - fade * 0.7);
  for (let l = 0; l < 5; l++) {
    const tip = fit(DIRS[l]);
    ctx.save();
    ctx.globalAlpha = rayA;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(o[0], o[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    ctx.restore();
    caption(ctx, String(l), tip[0] + (tip[0] - o[0]) * 0.18, tip[1] + (tip[1] - o[1]) * 0.18, ink, rayA * 1.3);
  }

  // The walk: a bold ink polyline with a paper casing so it reads over the tiles.
  if (shown > 0) {
    for (const [w, col] of [[5.5, paper], [2.6, ink]] as const) {
      ctx.save();
      ctx.beginPath();
      const p0 = fit(tile.path[0]);
      ctx.moveTo(p0[0], p0[1]);
      for (let i = 1; i <= shown; i++) {
        const [x, y] = fit(tile.path[i]);
        ctx.lineTo(x, y);
      }
      ctx.lineWidth = w;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = col;
      ctx.stroke();
      ctx.restore();
    }
    arrowHead(ctx, fit(tile.path[shown - 1]), fit(tile.path[shown]), ink);
    for (let i = 1; i <= shown; i++) {
      const [x, y] = fit(tile.path[i]);
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = ink;
      ctx.fill();
    }
  }

  // Origin marker.
  ctx.beginPath();
  ctx.arc(o[0], o[1], 3.4, 0, Math.PI * 2);
  ctx.fillStyle = ink;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(o[0], o[1], 3.4, 0, Math.PI * 2);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = paper;
  ctx.stroke();
  caption(ctx, "origin", o[0], o[1] + 15, ink, 0.5 * (1 - fade * 0.5));

  // Group labels: name each direction run, only while we are walking it.
  if (fade < 0.4) {
    for (let l = 0; l < 5; l++) {
      const r = ranges[l];
      if (!r || shown <= r.start) continue;
      const midStep = Math.min(shown, (r.start + r.end) / 2);
      const a = tile.path[Math.floor(midStep)];
      const b = tile.path[Math.min(tile.path.length - 1, Math.ceil(midStep))];
      const [mx, my] = fit([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      const sign = r.count < 0 ? "−" : "";
      const mag = Math.abs(r.count) > 1 ? ` ×${Math.abs(r.count)}` : "";
      caption(ctx, `${sign}d${l}${mag}`, mx, my - 12, ink, (1 - fade / 0.4) * 0.85);
    }
  }

  // The address row, up top. Each digit lights as the walk reaches its direction.
  ctx.save();
  ctx.font = "15px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  caption(ctx, "ADDRESS", VB_W / 2, 14, ink, 0.5);
  const digitGap = 30;
  const startX = VB_W / 2 - (digitGap * 4) / 2;
  for (let l = 0; l < 5; l++) {
    const r = ranges[l];
    const alpha = r && shown >= r.start + 1 ? 0.95 : r ? 0.4 : 0.28;
    const x = startX + l * digitGap;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ink;
    ctx.fillText(String(tile.coord[l]), x, 34);
    if (r && shown > r.start && shown < r.end) {
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x - 7, 45, 14, 1.5);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // Bottom caption.
  if (fade > 0.2) {
    caption(ctx, "the address names this tile in the whole grid", VB_W / 2, VB_H - 14, ink, fade * 0.8);
  } else {
    caption(ctx, "walk the address: a step along each direction, counted", VB_W / 2, VB_H - 14, ink, 0.72);
  }
}

export default function AddressWalk() {
  const tile = useMemo(() => pickAddressTile(), []);
  const patch = useMemo(() => buildPatch(), []);
  const ranges = useMemo(() => digitRanges(tile), [tile]);
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
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      if (dpr !== dprRef.current) {
        dprRef.current = dpr;
        canvas.width = VB_W * dpr;
        canvas.height = VB_H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        refreshColors();
      }
      paint(ctx, t, tile, patch, ranges, colorsRef.current);
    },
    [refreshColors, tile, patch, ranges],
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

  const addr = tile.coord.join(", ");

  return (
    <Sketch
      label="sketch 07 · every tile knows its address"
      animation={{ duration: 6500, render, slider: { label: "walk" } }}
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
        aria-label={`A ${tile.type} tile's address is the five integers [${addr}]. Each integer counts steps along one of five fixed directions, the tile's own edge directions, drawn as labeled rays from the origin. The walk steps out from the origin, one ray at a time, and lands exactly on the tile's corner. Then the rest of the tiling fades in around it, showing where that one address sits in the whole grid, with the path still drawn on top. The address is a walk from the origin to the tile, the same coordinate the explorer reads under your cursor.`}
      />
      <div className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5]">
        <p>
          Address <span className="font-mono">[{addr}]</span>. Read it as a walk:
          each number is how many steps to take along one of five fixed directions,
          the tile&#39;s own edge directions. Start at the origin, take the steps,
          and you arrive at this {tile.type} tile. Negative means step the other way.
        </p>
        <p className="mt-2 opacity-70">
          Then the rest of the tiling fills in around it. Every tile gets five
          integers like this, an exact name on a floor with no edges. That is the
          coordinate the explorer reads under your cursor, and a shared link is just
          these five numbers.
        </p>
      </div>
    </Sketch>
  );
}
