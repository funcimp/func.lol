"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import type { Gap, SceneB, Tile } from "./lib/geomWall";
import walls from "./lib/geomWalls.json";
import { overlapPolygon, type Pt } from "./lib/overlap";

// "The thin fits, place it, and now nothing fits": the spine's section-5 sketch,
// recast as PURE GEOMETRY. A Penrose expert objected to the old framing: "you
// reject a move but a tile visibly fits there." The old sketch marked a frontier
// edge doomed because its only fill would close an illegal vertex. The shape fit;
// we only asserted a rule.
//
// This version follows the tempting move THROUGH. It renders the thin-refuted
// scene from geomWalls.json (computed by lib/geomWall.ts, bound to the proof by
// geomWall.test.ts), the SAME rich 16-edge hole as before. The hole has one
// surviving completion. On one frontier edge a THIN rhombus fits with zero
// overlap, the exact move the expert pointed at. We place it, keep building the
// locally legal prefix, and reach a gap where every candidate rhombus OVERLAPS a
// committed tile by real area, which we SHADE. The claim is now "the thin fits,
// place it, keep going, and now nothing fits", not "this vertex is an illegal
// star". Then the one surviving completion finishes the hole.
//
// Canvas, like the other animated sketches: the harness drives render(t)
// imperatively, theme colours are read live so the patch inverts with the toggle.

const scene = walls.sceneB_thinRefuted as unknown as SceneB;

const VB_W = 560;
const VB_H = 540;
const MARGIN = 30;
const WALL_RING = 3.4; // draw wall tiles whose centroid is within this of the hole

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
// Viewport: fit the hole, its completion, the forced prefix, the tempting thin,
// and the gaps, plus a ring of nearby wall tiles for context. Computed once.
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
  const gap = [...scene.unfillableGaps].sort(
    (a, b) =>
      a.candidates.length - b.candidates.length ||
      a.edge[0][0] - b.edge[0][0],
  )[0];

  const pts: Pt[] = [...scene.holePolygon];
  for (const t of scene.completion) for (const p of t.v) pts.push(p);
  for (const t of scene.forcedPrefix) for (const p of t.v) pts.push(p);
  for (const p of scene.temptingThin.v) pts.push(p);
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

// Shade the real intersection of a candidate with the board: the wall the viewer
// sees IS the overlap area. We compute the candidate's worst overlap over the
// whole board and fill that polygon in solid ink.
function shadeWorstOverlap(
  ctx: CanvasRenderingContext2D,
  cand: readonly Pt[],
  board: readonly (readonly Pt[])[],
  toPx: (p: Pt) => [number, number],
  ink: string,
  alpha: number,
) {
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
  if (worst.length < 3) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  pathPoly(ctx, worst, toPx);
  ctx.fillStyle = ink;
  ctx.fill();
  ctx.restore();
}

function strokeEdge(
  ctx: CanvasRenderingContext2D,
  edge: readonly [Pt, Pt],
  toPx: (p: Pt) => [number, number],
  color: string,
  width: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const [ax, ay] = toPx(edge[0]);
  const [bx, by] = toPx(edge[1]);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.stroke();
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
// Timeline. Wall ring + hole outline appear, the locally legal forced prefix
// builds, the tempting thin seats (it fits!), then the gap glows and every
// candidate shades its overlap. Last, the wrong path clears and the one surviving
// completion grows and holds. Fixed order, so the slider scrubs it.
// ---------------------------------------------------------------------------

const WALL_IN = 0.1; // [0, WALL_IN] wall ring + hole outline appear
const PREFIX_TO = 0.34; // the forced prefix builds, all locally legal
const THIN_TO = 0.46; // the tempting thin seats cleanly
const WALL_TO = 0.66; // the gap glows; candidates shade their overlap
const COMP_FROM = 0.72; // the surviving completion grows after the wall

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

  // 1. The committed wall ring, muted so the hole and the action read above it.
  const wallIn = smooth(0, WALL_IN, t);
  if (wallIn > 0) {
    for (const tile of wall) {
      fillTile(
        ctx,
        tile.v,
        toPx,
        tile.type === "fat" ? thick : thin,
        ink,
        wallIn * 0.32,
        0.8,
      );
    }
    strokeLoop(ctx, scene.holePolygon, toPx, ink, 2, wallIn, [5, 4]);
    caption(
      ctx,
      "one hole, one surviving completion",
      VB_W / 2,
      18,
      ink,
      wallIn * 0.85,
    );
  }

  const atEnd = t >= 1;

  // END STATE (reduced motion / t = 1): the wrong path placed (prefix + thin),
  // ghosted; the gap shaded with every overlapping candidate; and the surviving
  // completion solid. Static, the whole story in one frame.
  if (atEnd) {
    const board = [...scene.wall, ...scene.forcedPrefix, scene.temptingThin].map(
      (x) => x.v,
    );
    // The locally legal prefix and the tempting thin, ghosted (they placed, then
    // stranded).
    for (const tile of scene.forcedPrefix) {
      fillTile(ctx, tile.v, toPx, ink, ink, 0.12, 0.8);
    }
    fillTile(ctx, scene.temptingThin.v, toPx, ink, ink, 0.16, 1);
    strokeLoop(ctx, scene.temptingThin.v, toPx, ink, 1.4, 0.5, [4, 3]);
    // Every candidate on the gap, each shading its real overlap with the board.
    for (const cand of gap.candidates) {
      strokeLoop(ctx, cand.v, toPx, ink, 1, 0.26, [2, 3]);
      shadeWorstOverlap(ctx, cand.v, board, toPx, ink, 0.36);
    }
    // The one surviving completion, solid.
    for (const tile of scene.completion) {
      fillTile(
        ctx,
        tile.v,
        toPx,
        tile.type === "fat" ? thick : thin,
        ink,
        0.92,
        1.1,
      );
    }
    caption(
      ctx,
      "the thin fits; place it, keep going, and now nothing fits",
      VB_W / 2,
      VB_H - 30,
      ink,
      0.8,
    );
    caption(
      ctx,
      "only one completion survives, by the shapes alone",
      VB_W / 2,
      VB_H - 14,
      ink,
      0.62,
    );
    return;
  }

  // The fade that clears the wrong path once the completion takes over.
  const clear = 1 - smooth(COMP_FROM, COMP_FROM + 0.06, t);

  // 2. The locally legal forced prefix builds, tile by tile.
  const prefixReveal = smooth(WALL_IN, PREFIX_TO, t);
  if (prefixReveal > 0 && clear > 0) {
    const per = 1 / Math.max(1, scene.forcedPrefix.length);
    scene.forcedPrefix.forEach((tile, k) => {
      const appear = smooth(k * per, (k + 1) * per, prefixReveal) * clear;
      if (appear <= 0) return;
      // muted/ghosted: the build looks fine, but it is the doomed path
      fillTile(
        ctx,
        tile.v,
        toPx,
        tile.type === "fat" ? thick : thin,
        ink,
        appear * 0.5,
        1,
      );
    });
    if (t < PREFIX_TO) {
      caption(
        ctx,
        "a few locally legal tiles, all fine so far",
        VB_W / 2,
        VB_H - 20,
        ink,
        prefixReveal * 0.85,
      );
    }
  }

  // 3. The tempting thin seats cleanly on the doomed edge (it fits!).
  const thinReveal = smooth(PREFIX_TO, THIN_TO, t);
  if (thinReveal > 0 && clear > 0) {
    fillTile(
      ctx,
      scene.temptingThin.v,
      toPx,
      scene.temptingThin.type === "fat" ? thick : thin,
      ink,
      thinReveal * clear,
      1.1,
    );
    strokeEdge(ctx, scene.doomedEdge, toPx, ink, 2.6, thinReveal * clear * 0.7);
    // The thin caption holds only briefly after it seats, then hands the bottom
    // line over to the wall caption so the two never stack.
    if (t >= PREFIX_TO && t < THIN_TO + 0.06) {
      caption(
        ctx,
        "the thin the expert pointed at fits here, zero overlap",
        VB_W / 2,
        VB_H - 20,
        ink,
        thinReveal * 0.85,
      );
    }
  }

  // 4. The gap glows; every candidate shades its overlap with a committed tile.
  const wallReveal = smooth(THIN_TO, WALL_TO, t);
  if (wallReveal > 0 && clear > 0) {
    const board = [...scene.wall, ...scene.forcedPrefix, scene.temptingThin].map(
      (x) => x.v,
    );
    strokeEdge(ctx, gap.edge, toPx, ink, 3, wallReveal * clear);
    const per = 1 / gap.candidates.length;
    gap.candidates.forEach((cand, k) => {
      const appear = smooth(k * per, (k + 1) * per, wallReveal) * clear;
      if (appear <= 0) return;
      strokeLoop(ctx, cand.v, toPx, ink, 1, appear * 0.26, [2, 3]);
      shadeWorstOverlap(ctx, cand.v, board, toPx, ink, appear * 0.4);
    });
    if (t >= THIN_TO + 0.06 && t < COMP_FROM) {
      caption(
        ctx,
        "every piece for the next gap overlaps a placed tile",
        VB_W / 2,
        VB_H - 20,
        ink,
        wallReveal * 0.85,
      );
    }
  }

  // 5. The one surviving completion grows and holds solid.
  const comp = smooth(COMP_FROM, 0.96, t);
  if (comp > 0) {
    const per = 1 / scene.completion.length;
    scene.completion.forEach((tile, k) => {
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
    caption(
      ctx,
      "only one completion survives",
      VB_W / 2,
      VB_H - 16,
      ink,
      comp * 0.85,
    );
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
      label="sketch 03 · the thin fits, place it, now nothing fits"
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
        aria-label="A real Penrose patch surrounds a single closed sixteen-edge hole with exactly one surviving completion. A few locally legal tiles build along one path, then on the doomed frontier edge a thin rhombus, the exact piece a Penrose expert said fits there, seats with zero overlap. Following it through, the next gap glows and every candidate rhombus is shown overlapping a committed tile, with the real overlap area shaded. The thin fits, you place it, you keep going, and now nothing fits, by the shapes alone with no matching rule invoked. Then the one surviving completion finishes the hole. The static end state shows the placed wrong path ghosted, the gap with every candidate overlapping shaded, and the surviving completion solid."
      />
    </Sketch>
  );
}
