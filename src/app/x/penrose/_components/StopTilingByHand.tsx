"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import type { Gap, SceneA, Tile } from "./lib/geomWall";
import walls from "./lib/geomWalls.json";
import { overlapPolygon, type Pt } from "./lib/overlap";

// "A piece fits, and still strands you": the spine's section-4 sketch, recast as
// PURE GEOMETRY. The earlier version rejected the tempting move by the matching
// rule (a thin fits the wedge, but the rule forbids closing that vertex). A
// Penrose expert can dispute that: the shape fits, you have only asserted a rule.
//
// So this version never invokes the rule. It renders the rigid hexagon scene from
// geomWalls.json (computed by lib/geomWall.ts, bound to the proof by
// geomWall.test.ts). The hole has exactly ONE geometry-only filling. The
// constrained edge admits two rhombi by bare geometry; one completes, the other
// (the tempting fat-108 move) seats cleanly and then STRANDS. After it, every
// candidate on the next gap overlaps a committed tile by real area, which we
// SHADE. The wall is geometry, not a label. No one can dispute a tile sitting on
// top of another tile.
//
// On the open plane the bare shapes never trap you (they would tile boringly),
// which is exactly why Penrose added the matching marks. Here the bounded region
// lets the geometry speak.
//
// Canvas, like the other animated sketches: the harness drives render(t)
// imperatively, theme colours are read live via getComputedStyle so the patch
// inverts with the light/dark toggle.

const scene = walls.sceneA_rigidHexagon as unknown as SceneA;

const VB_W = 520;
const VB_H = 460;
const MARGIN = 40;
const WALL_RING = 1.9; // draw wall tiles whose centroid is within this of the hole

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
// Viewport: fit the hole, its completion, the wrong move and gaps, and a tight
// ring of wall tiles for context. Computed once; the scene is static data.
// ---------------------------------------------------------------------------

type View = {
  toPx: (p: Pt) => [number, number];
  wall: Tile[];
  gap: Gap; // the single most-constrained unfillable gap we showcase
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
  // The most-constrained gap: the one with the fewest candidates (then leftmost),
  // so the showcase is deterministic and tidy.
  const gap = [...scene.unfillableGaps].sort(
    (a, b) =>
      a.candidates.length - b.candidates.length ||
      a.edge[0][0] - b.edge[0][0],
  )[0];

  const pts: Pt[] = [...scene.holePolygon];
  for (const t of scene.uniqueCompletion) for (const p of t.v) pts.push(p);
  for (const p of scene.wrongMove.v) pts.push(p);
  for (const t of wall) for (const p of t.v) pts.push(p);
  for (const cand of gap.candidates) for (const p of cand.v) pts.push(p);

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
  return { toPx, wall, gap };
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

function strokeLoop(
  ctx: CanvasRenderingContext2D,
  loop: readonly Pt[],
  toPx: (p: Pt) => [number, number],
  color: string,
  width: number,
  alpha: number,
  dash: number[] = [],
) {
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

// Shade the real intersection of two polygons in solid ink (the wall the viewer
// sees IS the overlap area, not a label). A small hatch reads even where the fill
// is faint.
function shadeOverlap(
  ctx: CanvasRenderingContext2D,
  poly: Pt[],
  toPx: (p: Pt) => [number, number],
  ink: string,
  alpha: number,
) {
  if (poly.length < 3) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  pathPoly(ctx, poly, toPx);
  ctx.fillStyle = ink;
  ctx.fill();
  ctx.restore();
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

// ---------------------------------------------------------------------------
// Timeline. Outline the hole, seat the tempting fat-108 move (it fits), then the
// gap glows and every candidate shades its overlap (the climax: nothing fits).
// Then the failed attempts clear, the one correct fat-72 filling completes, and
// the patch settles into a clean finished region. The order is fixed, so the
// slider scrubs it; t = 1 is the clean resolved patch, the litter gone.
// ---------------------------------------------------------------------------

const HOLE_IN = 0.1; // [0, HOLE_IN] wall ring + hole outline appear
const SEAT_FROM = 0.14; // the tempting move seats cleanly
const SEAT_TO = 0.34;
const WALL_FROM = 0.4; // the gap glows; candidates shade their overlap
const WALL_TO = 0.64;
const COMP_FROM = 0.72; // the failed attempts clear; the right filling grows
const COMP_TO = 0.94;

// The candidate's worst (largest-area) real overlap with any board tile. The
// shaded polygon IS the wall the viewer sees, so the dead-end is geometry, not a
// label.
function worstOverlap(
  cand: readonly Pt[],
  board: readonly (readonly Pt[])[],
): Pt[] {
  let worst: Pt[] = [];
  let worstA = 0;
  for (const bv of board) {
    const ov = overlapPolygon(cand as Pt[], bv as Pt[]);
    if (ov.length < 3) continue;
    let a = 0;
    for (let i = 0; i < ov.length; i++) {
      const p = ov[i];
      const q = ov[(i + 1) % ov.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    a = Math.abs(a) / 2;
    if (a > worstA) {
      worstA = a;
      worst = ov;
    }
  }
  return worst;
}

function paint(
  ctx: CanvasRenderingContext2D,
  t: number,
  view: View,
  colors: Colors,
) {
  const { thick, thin, grout, ink } = colors;
  const { toPx, wall, gap } = view;

  ctx.clearRect(0, 0, VB_W, VB_H);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, VB_W, VB_H);

  const wallIn = smooth(0, HOLE_IN, t);
  const comp = smooth(COMP_FROM, COMP_TO, t);
  const clear = 1 - smooth(COMP_FROM, COMP_FROM + 0.1, t); // failed attempts fade out

  // 1. The committed wall ring. Muted while the hole is the subject, brightening
  // to a finished patch as the correct filling completes.
  if (wallIn > 0) {
    const wallAlpha = wallIn * (0.34 + 0.5 * comp);
    for (const tile of wall) {
      fillTile(
        ctx,
        tile.v,
        toPx,
        tile.type === "fat" ? thick : thin,
        ink,
        wallAlpha,
        0.8,
      );
    }
    // The hole outline, fading as the filling closes it.
    strokeLoop(ctx, scene.holePolygon, toPx, ink, 2, wallIn * (1 - comp), [5, 4]);
    if (comp < 0.6) {
      caption(
        ctx,
        "one small hole, exactly one filling",
        VB_W / 2,
        20,
        ink,
        wallIn * 0.85 * (1 - comp),
      );
    }
  }

  // 2. The tempting wrong move (fat-108) seats cleanly on the constrained edge,
  // then dims to a faint ghost under the climax and clears before the finish.
  const seat = smooth(SEAT_FROM, SEAT_TO, t);
  if (seat > 0 && clear > 0) {
    const dim = 1 - 0.7 * smooth(WALL_FROM, WALL_FROM + 0.06, t);
    fillTile(
      ctx,
      scene.wrongMove.v,
      toPx,
      scene.wrongMove.type === "fat" ? thick : thin,
      ink,
      seat * clear * dim,
      1.1,
    );
    if (t < WALL_FROM) {
      caption(ctx, "this piece fits cleanly", VB_W / 2, VB_H - 20, ink, seat * 0.85);
    }
  }

  // 3. The climax: the gap glows and every candidate shades its real overlap with
  // a committed tile. Nothing fits. Clears as the finish takes over.
  const wallReveal = smooth(WALL_FROM, WALL_TO, t);
  if (wallReveal > 0 && clear > 0) {
    const board = [...scene.wall, scene.wrongMove].map((x) => x.v);
    // Glow the gap edge.
    const [ea, eb] = gap.edge;
    ctx.save();
    ctx.globalAlpha = wallReveal * clear;
    const [ax, ay] = toPx(ea);
    const [bx, by] = toPx(eb);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.restore();

    // Reveal candidates one at a time, each shading its worst real overlap.
    const per = 1 / gap.candidates.length;
    gap.candidates.forEach((cand, k) => {
      const appear = smooth(k * per, (k + 1) * per, wallReveal) * clear;
      if (appear <= 0) return;
      strokeLoop(ctx, cand.v, toPx, ink, 1, appear * 0.3, [2, 3]);
      shadeOverlap(ctx, worstOverlap(cand.v, board), toPx, ink, appear * 0.42);
    });
    if (t < COMP_FROM) {
      caption(
        ctx,
        "now nothing fits: every piece overlaps",
        VB_W / 2,
        VB_H - 20,
        ink,
        wallReveal * clear * 0.85,
      );
    }
  }

  // 4. The one correct filling (fat-72) completes and the patch settles clean.
  if (comp > 0) {
    const per = 1 / scene.uniqueCompletion.length;
    scene.uniqueCompletion.forEach((tile, k) => {
      const appear = smooth(k * per, (k + 1) * per, comp);
      if (appear <= 0) return;
      fillTile(
        ctx,
        tile.v,
        toPx,
        tile.type === "fat" ? thick : thin,
        ink,
        appear * 0.92,
        1.1,
      );
    });
    if (comp > 0.5) {
      const lead = (comp - 0.5) / 0.5;
      caption(
        ctx,
        "the wrong piece fits, then strands; only one filling works",
        VB_W / 2,
        VB_H - 30,
        ink,
        lead * 0.8,
      );
      caption(
        ctx,
        "no rule invoked, the shapes alone decide",
        VB_W / 2,
        VB_H - 14,
        ink,
        lead * 0.62,
      );
    }
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

  // Repaint on theme flip so the stationary end state inverts with the toggle.
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
      label="sketch 02 · a piece fits, and still strands you"
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
        aria-label="A small six-edge hole carved from a real Penrose patch has exactly one filling by pure geometry. The constrained edge admits two rhombi that both fit; one is the tempting wrong move, a fat rhombus, which seats cleanly. Following it through, the next gap glows and every candidate rhombus is shown overlapping a committed tile, with the real overlap area shaded. Then the one correct filling completes the hole. A piece can fit and still strand you; only one filling works, and the shapes show it, with no matching rule invoked."
      />
    </Sketch>
  );
}
