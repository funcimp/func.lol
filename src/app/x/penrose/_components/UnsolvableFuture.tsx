"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import type { SceneB, Tile } from "./lib/geomWall";
import walls from "./lib/geomWalls.json";
import type { Pt } from "./lib/overlap";

// "The thin fits, place it, now nothing fits": the spine's section-5 sketch, PURE
// GEOMETRY. The expert's exact objection, refuted. A rich sixteen-edge hole carved
// from a real patch (geomWalls.json, computed by lib/geomWall.ts, bound by
// geomWall.test.ts). A few locally legal tiles build, then on the doomed edge a THIN
// rhombus seats with zero overlap, the move the expert pointed at.
//
// HOW WE SHOW THE STRAND. Place the thin, then fill the rest of the hole as far as
// the geometry allows (strandFill, the maximal legal partial fill). Tiles still
// cannot cover everything: a gap survives that no rhombus fits. We make it visible by
// painting the hole red and drawing the placed tiles opaque on top, so the red that
// remains is the uncovered gap. Then the one surviving completion replaces the wrong
// path, leaving no red. The red is geometry (hole minus the tiles drawn); the dead-end
// is the proof in geomWall.test.ts.
//
// Canvas: the harness drives render(t); theme colours are read live.

const scene = walls.sceneB_thinRefuted as unknown as SceneB;

const VB_W = 560;
const VB_H = 540;
const MARGIN = 30;
const WALL_RING = 3.4; // draw wall tiles whose centroid is within this of the hole
const RED = "#d24a3d"; // the "cannot be filled" gap colour, readable on either theme

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; grout: string; ink: string };

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

type View = {
  toPx: (p: Pt) => [number, number];
  wall: Tile[];
};

function centroid(v: readonly Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of v) {
    x += p[0];
    y += p[1];
  }
  return [x / v.length, y / v.length];
}

function buildView(): View {
  const c = scene.holeCenter;
  const wall = scene.wall.filter((t) => {
    const [cx, cy] = centroid(t.v);
    return Math.hypot(cx - c[0], cy - c[1]) <= WALL_RING;
  });

  const pts: Pt[] = [...scene.holePolygon];
  for (const t of scene.completion) for (const p of t.v) pts.push(p);
  for (const t of scene.forcedPrefix) for (const p of t.v) pts.push(p);
  for (const t of scene.strandFill) for (const p of t.v) pts.push(p);
  for (const p of scene.temptingThin.v) pts.push(p);
  for (const t of wall) for (const p of t.v) pts.push(p);

  let minx = Infinity;
  let maxx = -Infinity;
  let miny = Infinity;
  let maxy = -Infinity;
  for (const [x, y] of pts) {
    minx = Math.min(minx, x);
    maxx = Math.max(maxx, x);
    miny = Math.min(miny, y);
    maxy = Math.max(maxy, y);
  }
  const w = maxx - minx;
  const h = maxy - miny;
  const scale = Math.min((VB_W - 2 * MARGIN) / w, (VB_H - 2 * MARGIN) / h);
  const cx = (minx + maxx) / 2;
  const cy = (miny + maxy) / 2;
  const toPx = (p: Pt): [number, number] => [
    VB_W / 2 + (p[0] - cx) * scale,
    VB_H / 2 - (p[1] - cy) * scale, // canvas y grows downward
  ];
  return { toPx, wall };
}

// ---------------------------------------------------------------------------
// Drawing primitives.
// ---------------------------------------------------------------------------

function pathPoly(
  ctx: CanvasRenderingContext2D,
  v: readonly Pt[],
  toPx: (p: Pt) => [number, number],
) {
  ctx.beginPath();
  const [x0, y0] = toPx(v[0]);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < v.length; i++) {
    const [x, y] = toPx(v[i]);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function fillTile(
  ctx: CanvasRenderingContext2D,
  v: readonly Pt[],
  toPx: (p: Pt) => [number, number],
  fill: string,
  ink: string,
  alpha: number,
  lineWidth = 1.1,
) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  pathPoly(ctx, v, toPx);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.restore();
}

function fillPoly(
  ctx: CanvasRenderingContext2D,
  v: readonly Pt[],
  toPx: (p: Pt) => [number, number],
  color: string,
  alpha: number,
) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  pathPoly(ctx, v, toPx);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function strokeLoop(
  ctx: CanvasRenderingContext2D,
  loop: readonly Pt[],
  toPx: (p: Pt) => [number, number],
  color: string,
  width: number,
  alpha: number,
  dash: number[] = [],
) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  pathPoly(ctx, loop, toPx);
  ctx.setLineDash(dash);
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.setLineDash([]);
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

// Draw a list of tiles with a per-tile staggered reveal, opaque so they cover the
// red beneath. progress in [0,1]; mul scales the final opacity (for clearing).
function drawTiles(
  ctx: CanvasRenderingContext2D,
  tiles: readonly Tile[],
  toPx: (p: Pt) => [number, number],
  thick: string,
  thin: string,
  ink: string,
  progress: number,
  mul: number,
) {
  if (mul <= 0.001 || tiles.length === 0) return;
  const per = 1 / tiles.length;
  tiles.forEach((tile, k) => {
    const appear = smooth(k * per, (k + 1) * per, progress);
    if (appear <= 0) return;
    fillTile(ctx, tile.v, toPx, tile.type === "fat" ? thick : thin, ink, appear * mul, 1.1);
  });
}

// ---------------------------------------------------------------------------
// Timeline. Build the legal prefix, seat the tempting thin, fill the rest as far as
// the geometry allows, and reveal the RED gap nothing can fill. Then clear the wrong
// path and grow the one surviving completion. t = 1 is the clean resolved patch.
// ---------------------------------------------------------------------------

const WALL_IN = 0.08;
const PREFIX_FROM = 0.1;
const PREFIX_TO = 0.3;
const THIN_FROM = 0.32;
const THIN_TO = 0.42;
const STRAND_FROM = 0.46; // fill the rest; the red gap appears
const STRAND_TO = 0.66;
const CLEAR_FROM = 0.72; // the wrong path and red gap clear
const COMP_FROM = 0.76; // the surviving completion grows
const COMP_TO = 0.96;

function paint(
  ctx: CanvasRenderingContext2D,
  t: number,
  view: View,
  colors: Colors,
) {
  const { thick, thin, grout, ink } = colors;
  const { toPx, wall } = view;

  ctx.clearRect(0, 0, VB_W, VB_H);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, VB_W, VB_H);

  const wallIn = smooth(0, WALL_IN, t);
  const prefix = smooth(PREFIX_FROM, PREFIX_TO, t);
  const thinR = smooth(THIN_FROM, THIN_TO, t);
  const strand = smooth(STRAND_FROM, STRAND_TO, t);
  const comp = smooth(COMP_FROM, COMP_TO, t);
  const clear = 1 - smooth(CLEAR_FROM, CLEAR_FROM + 0.06, t); // wrong path + red fade

  // 1. Wall ring, muted then brightening to a finished patch.
  if (wallIn > 0) {
    const wallAlpha = wallIn * (0.32 + 0.5 * comp);
    for (const tile of wall) {
      fillTile(ctx, tile.v, toPx, tile.type === "fat" ? thick : thin, ink, wallAlpha, 0.8);
    }
    strokeLoop(ctx, scene.holePolygon, toPx, ink, 2, wallIn * (1 - comp) * (1 - strand * 0.6), [5, 4]);
  }

  // 2. The red gap: paint the whole hole red UNDER the wrong-path tiles, so the red
  // still showing once they are drawn is the uncovered gap nothing can fill.
  const redA = strand * clear;
  if (redA > 0) {
    fillPoly(ctx, scene.holePolygon, toPx, RED, redA * 0.66);
    strokeLoop(ctx, scene.holePolygon, toPx, RED, 1.5, redA * 0.7);
  }

  // 3. The wrong path, opaque so it covers the red: the legal prefix, the tempting
  // thin, and the maximal fill of the rest. What red is left is the gap.
  drawTiles(ctx, scene.forcedPrefix, toPx, thick, thin, ink, prefix, clear);
  if (thinR > 0 && clear > 0) {
    fillTile(ctx, scene.temptingThin.v, toPx, scene.temptingThin.type === "fat" ? thick : thin, ink, thinR * clear, 1.1);
  }
  drawTiles(ctx, scene.strandFill, toPx, thick, thin, ink, strand, clear);

  // 4. The one surviving completion grows on top and settles the patch clean.
  drawTiles(ctx, scene.completion, toPx, thick, thin, ink, comp, 1);

  // Captions, one beat at a time.
  if (t < THIN_FROM) {
    caption(ctx, "a few locally legal tiles, all fine so far", VB_W / 2, VB_H - 20, ink, prefix * 0.85);
  } else if (t < STRAND_FROM) {
    caption(ctx, "the thin the expert pointed at fits here, zero overlap", VB_W / 2, VB_H - 20, ink, thinR * 0.85);
  } else if (t < CLEAR_FROM) {
    caption(ctx, "fill in the rest, and the red gap can take no tile", VB_W / 2, VB_H - 20, ink, strand * clear * 0.9);
  } else if (comp > 0.35) {
    const lead = (comp - 0.35) / 0.65;
    caption(ctx, "only this completion survives", VB_W / 2, VB_H - 30, ink, lead * 0.85);
    caption(ctx, "no rule invoked, the shapes alone decide", VB_W / 2, VB_H - 14, ink, lead * 0.62);
  }
}

export default function UnsolvableFuture() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({
    thick: "#C89B3C",
    thin: "#3E6B7C",
    grout: "#0f0e0c",
    ink: "#ede9d8",
  });
  const dprRef = useRef(0);
  const view = useMemo(() => buildView(), []);

  const refreshColors = useCallback(() => {
    colorsRef.current = {
      thick: readVar("--color-penrose-thick", "#C89B3C"),
      thin: readVar("--color-penrose-thin", "#3E6B7C"),
      grout: readVar("--color-paper", "#0f0e0c"),
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
      paint(ctx, t, view, colorsRef.current);
    },
    [refreshColors, view],
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

  return (
    <Sketch
      label="sketch 05 · the thin fits, place it, now nothing fits"
      animation={{ duration: 9000, render, slider: { label: "search" } }}
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
        aria-label="A real Penrose patch surrounds a single sixteen-edge hole with exactly one surviving completion. A few locally legal tiles build, then on the doomed edge a thin rhombus, the exact piece a Penrose expert said fits there, seats with zero overlap. The animation then fills the rest of the hole as far as the geometry allows, and tiles still cannot cover everything: a gap survives, shown in red, that no rhombus fits. The thin fit, you placed it, you filled the rest, and a red gap is left. Then the wrong path clears and the one surviving completion finishes the hole, leaving no red. By the shapes alone, with no matching rule invoked."
      />
    </Sketch>
  );
}
