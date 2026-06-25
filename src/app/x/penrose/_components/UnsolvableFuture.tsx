"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import sceneData from "./lib/scene.json";
import type { Pt, Scene, Tile } from "./lib/unsolvableFuture";

// "An unsolvable future": the spine's section-5 sketch. The dead-end before it
// showed a local greedy hand stranding. This one is deeper and proven. A real
// legal patch surrounds a single closed hole. The hole has exactly ONE legal
// completion. Every other legal first move dooms the tiling: you can keep placing
// tiles, but one frontier edge can never close, so the hole can never finish.
//
// The sketch renders scene.json, the committed output of an EXHAUSTIVE search
// (lib/unsolvableFuture.ts). unsolvableFuture.test.ts re-runs that search and
// asserts the committed data matches it and that every dead-end is genuinely
// doomed (no candidate on the doomed edge is both legal and non-overlapping). So
// the drawing cannot drift from the proof. Nothing here is staged.
//
// THE HONEST FRAMING. We never say "no moves left" or "no tile fits". We say: a
// wrong but legal move permanently dooms one edge. For the sharp dead-ends a tile
// DOES fit the doomed edge; seating it would close an illegal vertex, so the rule
// forbids it, and that edge can never close. The tiling can never be completed,
// even though you can still place tiles elsewhere.
//
// Canvas, like the other animated sketches: the harness drives render(t)
// imperatively, theme colours are read live so the patch inverts with the toggle.

const scene = sceneData as unknown as Scene;

const VB_W = 560;
const VB_H = 520;
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
// Viewport: fit the hole, its completion, every dead-end fill, and a ring of
// nearby wall tiles for context. Computed once; the scene is static data.
// ---------------------------------------------------------------------------

type View = {
  toPx: (p: Pt) => [number, number];
  wall: Tile[]; // only the context ring, not all 410 tiles
};

function buildView(): View {
  const c = scene.meta.holeCenter;
  const wall = scene.wall.filter((t) => {
    let cx = 0;
    let cy = 0;
    for (const p of t.v) {
      cx += p[0];
      cy += p[1];
    }
    return Math.hypot(cx / 4 - c[0], cy / 4 - c[1]) <= WALL_RING;
  });

  const pts: Pt[] = [...scene.hole];
  for (const t of scene.completion) for (const p of t.v) pts.push(p);
  for (const d of scene.deadEnds) for (const t of d.fill) for (const p of t.v) pts.push(p);
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
  // Canvas y grows downward, so flip y.
  const toPx = (p: Pt): [number, number] => [
    VB_W / 2 + (p[0] - cx) * scale,
    VB_H / 2 - (p[1] - cy) * scale,
  ];
  return { toPx, wall };
}

// ---------------------------------------------------------------------------
// Drawing primitives.
// ---------------------------------------------------------------------------

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
  ctx.beginPath();
  const [x0, y0] = toPx(v[0]);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < v.length; i++) {
    const [x, y] = toPx(v[i]);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
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
  ctx.beginPath();
  const [x0, y0] = toPx(loop[0]);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < loop.length; i++) {
    const [x, y] = toPx(loop[i]);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.setLineDash(dash);
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.setLineDash([]);
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

function edgeMid(edge: readonly [Pt, Pt], toPx: (p: Pt) => [number, number]) {
  const [ax, ay] = toPx(edge[0]);
  const [bx, by] = toPx(edge[1]);
  return [(ax + bx) / 2, (ay + by) / 2] as [number, number];
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
// Timeline. The wall ring fades in, the hole is outlined, then each WRONG branch
// grows a few tiles (all locally legal), flashes its doomed edge with the honest
// reason, and fades. Last, the one forced branch grows to the full completion and
// stays solid. The order is fixed (scene order), so the animation is
// deterministic and the slider scrubs it.
// ---------------------------------------------------------------------------

const WALL_IN = 0.1; // [0, WALL_IN] wall ring + hole outline appear
const BRANCH_SPAN = 0.55; // the five wrong branches share this window
const COMPLETE_FROM = WALL_IN + BRANCH_SPAN; // completion grows after the branches

// One wrong branch occupies a slice of [WALL_IN, COMPLETE_FROM]. Within its slice
// it grows its fill (grow), flashes the doomed edge (flash), then fades (fade).
function branchSlice(i: number, n: number): [number, number] {
  const each = BRANCH_SPAN / n;
  return [WALL_IN + i * each, WALL_IN + (i + 1) * each];
}

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
  }

  // 2. The hole outline.
  const holeIn = smooth(0, WALL_IN, t);
  if (holeIn > 0) {
    strokeLoop(ctx, scene.hole, toPx, ink, 2, holeIn, [5, 4]);
    caption(
      ctx,
      "one hole, exactly one legal completion",
      VB_W / 2,
      18,
      ink,
      holeIn * 0.85,
    );
  }

  const n = scene.deadEnds.length;
  const atEnd = t >= 1;

  // 3a. END STATE (reduced motion / t = 1): completion solid, all five dead-ends
  // as grey ghost stubs each marked on its doomed edge. Static, no motion to read.
  if (atEnd) {
    for (const tile of scene.completion) {
      fillTile(
        ctx,
        tile.v,
        toPx,
        tile.type === "fat" ? thick : thin,
        ink,
        1,
        1.1,
      );
    }
    // Draw the ghost stubs and doomed-edge marks first, then place the captions
    // with a small collision avoidance so two nearby doomed edges do not stack
    // their labels on top of each other.
    const placed: [number, number][] = [];
    scene.deadEnds.forEach((d) => {
      for (const tile of d.fill) {
        // grey ghost stub: muted fill, hairline outline
        fillTile(ctx, tile.v, toPx, ink, ink, 0.12, 0.8);
      }
      strokeEdge(ctx, d.doomedEdge, toPx, ink, 2.6, 0.8);
      const [mx, my] = edgeMid(d.doomedEdge, toPx);
      crossMark(ctx, mx, my, ink, 0.85);
      let ly = my - 12;
      // nudge upward while another label sits within 13px of this spot
      while (placed.some(([px, py]) => Math.abs(px - mx) < 60 && Math.abs(py - ly) < 13)) {
        ly -= 13;
      }
      placed.push([mx, ly]);
      caption(ctx, `doomed @ ${d.depth}`, mx, ly, ink, 0.7);
    });
    caption(
      ctx,
      "the one forced fill completes; five legal moves dooming an edge",
      VB_W / 2,
      VB_H - 16,
      ink,
      0.7,
    );
    return;
  }

  // 3b. ANIMATED: replay the wrong branches in order, then grow the completion.
  // Only the branch whose slice contains t is drawn (the rest have faded).
  scene.deadEnds.forEach((d, i) => {
    const [s0, s1] = branchSlice(i, n);
    if (t < s0 || t >= s1) return;
    const local = (t - s0) / (s1 - s0);
    // grow [0, 0.5], hold+flash [0.5, 0.8], fade [0.8, 1]
    const grow = smooth(0, 0.5, local);
    const flash = smooth(0.5, 0.62, local);
    const fade = 1 - smooth(0.82, 1, local);

    const per = 0.5 / Math.max(1, d.fill.length);
    d.fill.forEach((tile, k) => {
      const appear = smooth(k * per, (k + 1) * per, local) * fade;
      if (appear <= 0) return;
      // wrong-branch tiles muted/ghosted: they look fine but read as provisional
      fillTile(
        ctx,
        tile.v,
        toPx,
        tile.type === "fat" ? thick : thin,
        ink,
        appear * 0.55,
        1,
      );
    });

    if (flash > 0 && fade > 0) {
      // doomed edge in warning ink (here: ink, the only chrome colour), bolder
      strokeEdge(ctx, d.doomedEdge, toPx, ink, 3, flash * fade);
      const [mx, my] = edgeMid(d.doomedEdge, toPx);
      crossMark(ctx, mx, my, ink, flash * fade);
      // the honest reason, wrapped to fit the frame
      wrapCaption(ctx, d.reason, VB_W / 2, VB_H - 30, ink, flash * fade * 0.9);
    }
    void grow;
  });

  // 4. The one forced branch: grow to the full completion, then hold solid.
  const compReveal = smooth(COMPLETE_FROM, 0.96, t);
  if (compReveal > 0) {
    const per = 1 / scene.completion.length;
    scene.completion.forEach((tile, k) => {
      const appear = smooth(k * per, (k + 1) * per, compReveal);
      if (appear <= 0) return;
      fillTile(
        ctx,
        tile.v,
        toPx,
        tile.type === "fat" ? thick : thin,
        ink,
        appear,
        1.1,
      );
    });
    caption(
      ctx,
      "only the forced fill survives",
      VB_W / 2,
      VB_H - 16,
      ink,
      compReveal * 0.85,
    );
  }
}

function crossMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ink: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  const s = 6;
  ctx.beginPath();
  ctx.moveTo(x - s, y - s);
  ctx.lineTo(x + s, y + s);
  ctx.moveTo(x + s, y - s);
  ctx.lineTo(x - s, y + s);
  ctx.stroke();
  ctx.restore();
}

// Wrap a one-line reason into at most two centred mono lines so it fits the frame.
function wrapCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  ink: string,
  alpha: number,
) {
  ctx.save();
  ctx.font =
    "11px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";
  const max = VB_W - 48;
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 2);
  ctx.restore();
  shown.forEach((line, i) =>
    caption(ctx, line, x, y + i * 14, ink, alpha),
  );
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
      label="sketch 03 · an unsolvable future"
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
        aria-label="A legal Penrose patch surrounds a single closed hole that has exactly one legal completion. The exhaustive search is replayed: at each wrong but legal branch a few tiles are placed, then one frontier edge is marked doomed, because the only tile that fits it would close an illegal vertex, so that edge can never close and the hole can never finish. Each wrong branch fades. Only the one forced fill reaches the full completion. The static end state shows the completion solid with the five dead-ends as grey stubs, each marked on its doomed edge."
      />
    </Sketch>
  );
}
