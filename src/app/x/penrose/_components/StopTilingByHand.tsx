"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import type { SceneA, Tile } from "./lib/geomWall";
import walls from "./lib/geomWalls.json";
import type { Pt } from "./lib/overlap";

// "A piece fits, and still strands you": the spine's section-4 sketch, PURE GEOMETRY.
// The rigid hexagon scene from geomWalls.json (computed by lib/geomWall.ts, bound to
// the proof by geomWall.test.ts) has exactly ONE geometry-only filling, two rhombi.
// The constrained edge admits two rhombi by bare geometry; one completes, the other
// (the tempting move) seats cleanly and then STRANDS.
//
// HOW WE SHOW THE STRAND. Place the tempting rhombus. It covers one rhombus of the
// two-rhombus hole, cleanly. What is left is the other rhombus of AREA but the WRONG
// shape: it is not a rhombus, so no tile can fill it. We make that visible by
// painting the whole hole red and drawing the placed tile opaque on top: the red that
// still shows is the uncovered gap, and it is triangles, which no rhombus fits. Then
// the one correct filling replaces it, clean. The red is geometry (hole minus the
// tiles drawn), not a label; the dead-end itself is the proof in geomWall.test.ts.
//
// Canvas: the harness drives render(t); theme colours are read live so the patch
// inverts with the toggle.

const scene = walls.sceneA_rigidHexagon as unknown as SceneA;

const VB_W = 520;
const VB_H = 460;
const MARGIN = 44;
const WALL_RING = 1.9; // draw wall tiles whose centroid is within this of the hole
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

// ---------------------------------------------------------------------------
// Viewport: fit the hole, its completion, the wrong move, and a tight ring of wall
// tiles for context. Computed once; the scene is static data.
// ---------------------------------------------------------------------------

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
  for (const t of scene.uniqueCompletion) for (const p of t.v) pts.push(p);
  for (const p of scene.wrongMove.v) pts.push(p);
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

// ---------------------------------------------------------------------------
// Timeline. Outline the hole, seat the tempting move (it fits), reveal the gap it
// leaves as RED triangles no tile can fill, then clear it and grow the one correct
// filling. t = 1 is the clean resolved patch.
// ---------------------------------------------------------------------------

const HOLE_IN = 0.1;
const SEAT_FROM = 0.16;
const SEAT_TO = 0.34;
const GAP_FROM = 0.42; // the red, unfillable triangles appear
const GAP_TO = 0.58;
const CLEAR_FROM = 0.7; // the wrong move and red gap clear
const COMP_FROM = 0.76; // the one correct filling grows
const COMP_TO = 0.94;

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

  const wallIn = smooth(0, HOLE_IN, t);
  const seat = smooth(SEAT_FROM, SEAT_TO, t);
  const gap = smooth(GAP_FROM, GAP_TO, t);
  const comp = smooth(COMP_FROM, COMP_TO, t);
  const clear = 1 - smooth(CLEAR_FROM, CLEAR_FROM + 0.06, t); // wrong move + red fade

  // 1. The committed wall ring, muted while the hole is the subject, brightening to
  // a finished patch as the correct filling completes.
  if (wallIn > 0) {
    const wallAlpha = wallIn * (0.34 + 0.5 * comp);
    for (const tile of wall) {
      fillTile(ctx, tile.v, toPx, tile.type === "fat" ? thick : thin, ink, wallAlpha, 0.8);
    }
    strokeLoop(ctx, scene.holePolygon, toPx, ink, 2, wallIn * (1 - comp) * (1 - gap * 0.6), [5, 4]);
  }

  // 2. The gap the wrong move leaves: paint the whole hole red UNDER the tiles, so
  // the red that still shows after the tile is drawn is the uncovered, unfillable
  // triangle(s). Frame it in red while it holds.
  const redA = gap * clear;
  if (redA > 0) {
    fillPoly(ctx, scene.holePolygon, toPx, RED, redA * 0.66);
    strokeLoop(ctx, scene.holePolygon, toPx, RED, 1.5, redA * 0.8);
  }

  // 3. The tempting wrong move, opaque so it covers the red beneath it; what red is
  // left is the gap it cannot help.
  const wrongA = seat * clear;
  if (wrongA > 0) {
    fillTile(
      ctx,
      scene.wrongMove.v,
      toPx,
      scene.wrongMove.type === "fat" ? thick : thin,
      ink,
      wrongA,
      1.1,
    );
  }

  // 4. The one correct filling grows on top and settles the patch clean.
  if (comp > 0) {
    const per = 1 / scene.uniqueCompletion.length;
    scene.uniqueCompletion.forEach((tile, k) => {
      const appear = smooth(k * per, (k + 1) * per, comp);
      if (appear <= 0) return;
      fillTile(ctx, tile.v, toPx, tile.type === "fat" ? thick : thin, ink, appear, 1.1);
    });
  }

  // Captions, one beat at a time.
  if (t < GAP_FROM) {
    caption(ctx, "one small hole, exactly one filling", VB_W / 2, 22, ink, wallIn * 0.8);
    if (seat > 0) caption(ctx, "this piece fits cleanly", VB_W / 2, VB_H - 22, ink, seat * 0.85);
  } else if (t < CLEAR_FROM) {
    caption(ctx, "but no tile can fill the red it leaves", VB_W / 2, VB_H - 22, ink, gap * clear * 0.9);
  } else if (comp > 0.35) {
    const lead = (comp - 0.35) / 0.65;
    caption(ctx, "only this filling works", VB_W / 2, VB_H - 30, ink, lead * 0.85);
    caption(ctx, "no rule invoked, the shapes alone decide", VB_W / 2, VB_H - 14, ink, lead * 0.62);
  }
}

export default function StopTilingByHand() {
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
      label="sketch 04 · a piece fits, and still strands you"
      animation={{ duration: 7000, render, slider: { label: "build" } }}
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
        aria-label="A small six-edge hole carved from a real Penrose patch has exactly one filling by pure geometry. A tempting rhombus seats on the constrained edge with zero overlap, so it looks fine. But it covers the hole the wrong way: what it leaves is shown in red, two triangles that no rhombus can fill. The animation then clears the wrong move and grows the one correct filling, which leaves no red. A piece can fit and still strand you, and the shapes alone show it, with no matching rule invoked."
      />
    </Sketch>
  );
}
