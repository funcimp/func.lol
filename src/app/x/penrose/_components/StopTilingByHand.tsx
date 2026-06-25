"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import Sketch from "./Sketch";
import { solveToDeadEnd, type Pt, type Solution, type Tile } from "./lib/naiveSolver";

// "Stop tiling by hand": the spine's section-5 sketch. The dead-end sketch
// before it staged one conflict to teach that local fit is necessary, not
// sufficient. This one PROVES the consequence with a solver, not a hand. It runs
// the real naive greedy algorithm from lib/naiveSolver: lay unit rhombi one at a
// time, obey only the matching rule, never look ahead. The build looks clean for
// ten tiles, then strands itself about two and a half tile-widths from the seed.
//
// The honest beat is the wedge. At the stranded vertex three fat corners are
// committed, 108 + 108 + 108, leaving a 36-degree gap. A thin acute corner is
// exactly 36 degrees, so it FITS the gap. We draw it greyed and struck. But it
// would close the vertex to [108,108,108,36], which is not one of the seven
// admissible Penrose vertex stars, so the matching rule forbids it. Every other
// candidate overlaps a placed tile. The rules leave no legal move. The claim is
// never "no tile fits": a tile fits, and the rules still forbid it. The whole
// sketch is computed by the same code naiveSolver.test.ts verifies, so it cannot
// drift into a fake.
//
// Canvas, like the other animated sketches: the harness drives render(t)
// imperatively, theme colours are read live via getComputedStyle so the patch
// inverts with the light/dark toggle.

const VB_W = 520;
const VB_H = 440;
const MARGIN = 34;

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

// The solver runs once; its result is deterministic. We fit the placed patch and
// the illegal ghost into the viewBox, then convert tile coordinates (y up) to
// canvas pixels (y down).
type View = {
  solution: Solution;
  toPx: (p: Pt) => Pt;
  wedge: Pt; // the stranded vertex in canvas px
};

function buildView(solution: Solution): View {
  const pts: Pt[] = [];
  for (const s of solution.steps) for (const p of s.tile.v) pts.push(p);
  for (const p of solution.deadEnd.ghost.v) pts.push(p);

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
  // Centre the content in the viewBox. Canvas y grows downward, so flip y.
  const cx = (minx + maxx) / 2;
  const cy = (miny + maxy) / 2;
  const toPx = (p: Pt): Pt => [
    VB_W / 2 + (p[0] - cx) * scale,
    VB_H / 2 - (p[1] - cy) * scale,
  ];
  return { solution, toPx, wedge: toPx(solution.deadEnd.vertex) };
}

function strokeTile(
  ctx: CanvasRenderingContext2D,
  v: readonly Pt[],
  toPx: (p: Pt) => Pt,
  ink: string,
  width: number,
  dash: number[] | null,
) {
  ctx.beginPath();
  const [x0, y0] = toPx(v[0]);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < v.length; i++) {
    const [x, y] = toPx(v[i]);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.setLineDash(dash ?? []);
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.setLineDash([]);
}

function fillTile(
  ctx: CanvasRenderingContext2D,
  v: readonly Pt[],
  toPx: (p: Pt) => Pt,
  fill: string,
  ink: string,
  alpha: number,
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
  ctx.lineWidth = 1.2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.restore();
}

// Reveal stages over t:
//   [0, LAY_END]      lay the solver's tiles one at a time, all clean and legal.
//   [LAY_END, MARK]   reveal the stranded wedge and the tempting illegal ghost.
//   [MARK, 1]         strike the ghost and label the wedge honestly. End at t=1.
const LAY_END = 0.72;
const MARK_END = 0.86;

function paint(
  ctx: CanvasRenderingContext2D,
  t: number,
  view: View,
  colors: Colors,
) {
  const { thick, thin, grout, ink } = colors;
  const { solution, toPx, wedge } = view;
  const { steps, deadEnd } = solution;

  ctx.clearRect(0, 0, VB_W, VB_H);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, VB_W, VB_H);

  // Lay the tiles one at a time. Each tile fades in over its own slice of the
  // laying window, so the patch grows in the solver's actual placement order.
  const per = LAY_END / steps.length;
  steps.forEach(({ index, tile }: { index: number; tile: Tile }) => {
    const appear = smooth(index * per, (index + 1) * per, t);
    if (appear <= 0) return;
    fillTile(
      ctx,
      tile.v,
      toPx,
      tile.type === "fat" ? thick : thin,
      ink,
      appear,
    );
  });

  // The tempting illegal ghost: a thin tile that fits the 36-degree wedge
  // geometrically. Drawn muted, dashed, struck. It fits; the rules forbid it.
  const ghostReveal = smooth(LAY_END, MARK_END, t);
  if (ghostReveal > 0) {
    ctx.save();
    ctx.globalAlpha = ghostReveal * 0.5;
    // a faint muted fill so the eye reads "a tile would sit here"
    ctx.beginPath();
    const g = deadEnd.ghost.v;
    const [gx0, gy0] = toPx(g[0]);
    ctx.moveTo(gx0, gy0);
    for (let i = 1; i < g.length; i++) {
      const [x, y] = toPx(g[i]);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = ink;
    ctx.globalAlpha = ghostReveal * 0.1;
    ctx.fill();
    ctx.restore();

    // its outline, dashed in ink: present but provisional
    ctx.save();
    ctx.globalAlpha = ghostReveal * 0.6;
    strokeTile(ctx, deadEnd.ghost.v, toPx, ink, 1.4, [4, 3]);
    ctx.restore();

    // a small ring at the stranded vertex so the wedge reads
    ctx.save();
    ctx.globalAlpha = ghostReveal;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(wedge[0], wedge[1], 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Strike the ghost and label the wedge honestly. This is the end state at t=1.
  const strike = smooth(MARK_END, 1, t);
  if (strike > 0) {
    // strike across the ghost's body centroid
    const g = deadEnd.ghost.v;
    let sx = 0;
    let sy = 0;
    for (const p of g) {
      const [px, py] = toPx(p);
      sx += px;
      sy += py;
    }
    sx /= g.length;
    sy /= g.length;

    ctx.save();
    ctx.globalAlpha = strike;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    const span = 10;
    ctx.beginPath();
    ctx.moveTo(sx - span, sy - span);
    ctx.lineTo(sx + span, sy + span);
    ctx.moveTo(sx + span, sy - span);
    ctx.lineTo(sx - span, sy + span);
    ctx.stroke();
    ctx.restore();

    // Honest two-line label, placed in the open canvas below the struck ghost so
    // it never sits over a placed tile. The ghost points down into empty space;
    // we find its lowest corner and write under it.
    let maxYpx = -Infinity;
    for (const p of g) {
      const [, py] = toPx(p);
      maxYpx = Math.max(maxYpx, py);
    }
    const ly = Math.min(maxYpx + 18, VB_H - 22);
    ctx.save();
    ctx.globalAlpha = strike * 0.92;
    ctx.fillStyle = ink;
    ctx.font =
      "11px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("FITS THE GAP", sx, ly);
    ctx.globalAlpha = strike * 0.62;
    ctx.fillText("forbidden by the rule", sx, ly + 16);
    ctx.restore();
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

  // The solver is deterministic; run it once for the lifetime of the component.
  const view = useMemo(() => buildView(solveToDeadEnd()), []);

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
      label="sketch 03 · the naive solver strands"
      animation={{ duration: 6400, render, slider: { label: "lay" } }}
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
        aria-label="A naive greedy solver lays Penrose rhombi one at a time, obeying only the local matching rule. After about ten clean placements it strands itself near the seed: a vertex with three fat corners leaving a 36-degree wedge. A thin tile fits that wedge exactly and is drawn greyed and struck through, because seating it would close the vertex to an arrangement no Penrose tiling allows, so the rule forbids it. A tile fits the gap and is still illegal."
      />
    </Sketch>
  );
}
