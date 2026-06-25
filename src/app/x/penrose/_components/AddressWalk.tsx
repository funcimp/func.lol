"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import {
  DIRS,
  pickAddressTile,
  type AddressTile,
} from "./lib/address";

// "Every tile knows its address": the spine's section-8 sketch. The address is the
// tile's ℤ⁵ coordinate, five integers. This makes them concrete: each integer is a
// count of steps along one of five fixed directions (the tile's own edge directions),
// and walking those steps from the origin lands exactly on the tile's corner. So the
// address is not a label stuck on afterward, it is a path you can walk.
//
// Bound to address.ts (and address.test.ts): the directions, the walk, and the tile
// are all from the real engine, and the walk provably ends at physical(coord).
//
// Canvas, like the other animated sketches: the harness drives render(t); t reveals
// the walk step by step. Theme colors are read live, and the reduced-motion end state
// is the full walk landing on the lit tile with its address spelled out.

const VB_W = 560;
const VB_H = 440;
const PAD = 34;

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; paper: string; ink: string };

type Pt = readonly [number, number];

function makeFit(tile: AddressTile) {
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  const all: Pt[] = [...tile.path, ...tile.corners, ...DIRS, [0, 0]];
  for (const [x, y] of all) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY) / 2 + 0.7;
  const s = Math.min(
    (VB_W - 2 * PAD) / (2 * half),
    (VB_H - 2 * PAD - 40) / (2 * half),
  );
  return (p: Pt): [number, number] => [
    VB_W / 2 + (p[0] - cx) * s,
    VB_H / 2 + 16 - (p[1] - cy) * s, // leave room for the address row up top
  ];
}

// Per-digit step ranges, so each address digit can light as the walk reaches it.
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
  align: CanvasTextAlign = "center",
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ink;
  ctx.font =
    "11px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";
  ctx.textAlign = align;
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
  const len = 8;
  ctx.save();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(to[0], to[1]);
  ctx.lineTo(
    to[0] - len * Math.cos(ang - 0.4),
    to[1] - len * Math.sin(ang - 0.4),
  );
  ctx.lineTo(
    to[0] - len * Math.cos(ang + 0.4),
    to[1] - len * Math.sin(ang + 0.4),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paint(
  ctx: CanvasRenderingContext2D,
  t: number,
  tile: AddressTile,
  ranges: Range[],
  colors: Colors,
) {
  const { thick, thin, paper, ink } = colors;
  const fit = makeFit(tile);
  const T = tile.path.length - 1;
  const shown = Math.max(0, Math.min(T, Math.round(t * T)));
  const done = shown >= T;

  ctx.clearRect(0, 0, VB_W, VB_H);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, VB_W, VB_H);

  // The address row, up top. Each digit lights as the walk reaches its direction.
  ctx.save();
  ctx.font =
    "15px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";
  ctx.textBaseline = "middle";
  const digitGap = 30;
  const rowW = digitGap * 4;
  const startX = VB_W / 2 - rowW / 2;
  ctx.textAlign = "center";
  caption(ctx, "ADDRESS", VB_W / 2, 16, ink, 0.5);
  for (let l = 0; l < 5; l++) {
    const r = ranges[l];
    let alpha = 0.28;
    if (r) {
      if (shown >= r.end) alpha = 0.95;
      else if (shown > r.start) alpha = 0.95;
    }
    const x = startX + l * digitGap;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ink;
    ctx.fillText(String(tile.coord[l]), x, 36);
    // a tick under the digit currently being walked
    if (r && shown > r.start && shown < r.end) {
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x - 7, 47, 14, 1.5);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // The five direction rays from the origin, faint, labeled. These are the tile edge
  // directions; the address counts steps along them.
  const o = fit([0, 0]);
  for (let l = 0; l < 5; l++) {
    const tip = fit(DIRS[l]);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(o[0], o[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    ctx.restore();
    caption(
      ctx,
      String(l),
      tip[0] + (tip[0] - o[0]) * 0.12,
      tip[1] + (tip[1] - o[1]) * 0.12,
      ink,
      0.4,
    );
  }

  // The destination tile, faint until the walk arrives.
  ctx.save();
  ctx.beginPath();
  tile.corners.forEach((c, i) => {
    const [x, y] = fit(c);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = tile.type === "thick" ? thick : thin;
  ctx.globalAlpha = done ? 0.92 : 0.16;
  ctx.fill();
  ctx.lineWidth = done ? 1.6 : 0.8;
  ctx.strokeStyle = ink;
  ctx.globalAlpha = done ? 0.9 : 0.3;
  ctx.stroke();
  ctx.restore();

  // The walk so far: an ink polyline along the unit steps, joints marked.
  if (shown > 0) {
    ctx.save();
    ctx.beginPath();
    const p0 = fit(tile.path[0]);
    ctx.moveTo(p0[0], p0[1]);
    for (let i = 1; i <= shown; i++) {
      const [x, y] = fit(tile.path[i]);
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.restore();
    // arrowhead at the leading point
    arrowHead(ctx, fit(tile.path[shown - 1]), fit(tile.path[shown]), ink);
    // joints
    for (let i = 1; i <= shown; i++) {
      const [x, y] = fit(tile.path[i]);
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = ink;
      ctx.fill();
    }
  }

  // Origin marker.
  ctx.beginPath();
  ctx.arc(o[0], o[1], 3.2, 0, Math.PI * 2);
  ctx.fillStyle = ink;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(o[0], o[1], 3.2, 0, Math.PI * 2);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = paper;
  ctx.stroke();
  caption(ctx, "origin", o[0], o[1] + 16, ink, 0.5);

  // Group labels: name each direction run as it is walked.
  for (let l = 0; l < 5; l++) {
    const r = ranges[l];
    if (!r || shown <= r.start) continue;
    const midStep = Math.min(shown, (r.start + r.end) / 2);
    const a = tile.path[Math.floor(midStep)];
    const b = tile.path[Math.min(tile.path.length - 1, Math.ceil(midStep))];
    const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const [mx, my] = fit(mid);
    const sign = r.count < 0 ? "−" : "";
    const mag = Math.abs(r.count) > 1 ? ` ×${Math.abs(r.count)}` : "";
    caption(ctx, `${sign}d${l}${mag}`, mx, my - 12, ink, 0.8);
  }

  // Bottom caption.
  if (done) {
    caption(
      ctx,
      `five numbers, five directions: the walk lands on this ${tile.type} tile`,
      VB_W / 2,
      VB_H - 14,
      ink,
      0.78,
    );
  } else {
    caption(
      ctx,
      "walk the address: a step along each direction, counted",
      VB_W / 2,
      VB_H - 14,
      ink,
      0.7,
    );
  }
}

export default function AddressWalk() {
  const tile = useMemo(() => pickAddressTile(), []);
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
      paint(ctx, t, tile, ranges, colorsRef.current);
    },
    [refreshColors, tile, ranges],
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
      animation={{ duration: 5200, render, slider: { label: "walk" } }}
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
        aria-label={`A ${tile.type} tile's address is the five integers [${addr}]. Each integer counts steps along one of five fixed directions, the tile's own edge directions, drawn as labeled rays from the origin. Walking those steps from the origin, one ray at a time, traces a path that lands exactly on the tile's corner. The address is therefore a walk from the origin to the tile, not a label added afterward, and it is the same coordinate the explorer reads under your cursor.`}
      />
      <div className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5]">
        <p>
          Address <span className="font-mono">[{addr}]</span>. Read it as a walk:
          each number is how many steps to take along one of five fixed directions,
          the tile&#39;s own edge directions. Start at the origin, take the steps,
          and you arrive at this {tile.type} tile. Negative means step the other way.
        </p>
        <p className="mt-2 opacity-70">
          Every tile gets five integers like this, an exact name on a floor with no
          edges. That is the coordinate the explorer reads under your cursor, and a
          shared link is just these five numbers.
        </p>
      </div>
    </Sketch>
  );
}
