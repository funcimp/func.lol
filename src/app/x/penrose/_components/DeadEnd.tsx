"use client";

import { useCallback, useEffect, useRef } from "react";

import Sketch from "./Sketch";
import { fanTile, type Pt } from "./lib/tiles";

// "The dead-end": the spine's first animated sketch. It teaches NON-LOCALITY.
// Penrose's rhombi carry edge-matching marks; obey them and a tile fits its
// neighbour. But local fit is necessary, not sufficient. Lay tiles by the marks
// alone and you can paint yourself into a corner far from where you started.
//
// Penrose told the story (Ball, Prospect): he saw a university floor whose edge
// tile broke the rule, so the pattern "would go wrong somewhere in the middle of
// the lawn." This sketch stages exactly that. A small fan of rhombi is laid one
// at a time around a shared vertex. Every placement obeys the marks. The angles
// even leave a clean 72-degree wedge, a legal thick-rhombus corner. Yet the two
// marks flanking that wedge demand opposite things, so no tile can seat there.
// The patch is stuck. We strike the gap out at the end.
//
// The sequence is HAND-AUTHORED, not engine-generated. That is the whole point:
// the explorer's global method never produces a dead-end, because it does not lay
// tiles locally at all. Only a greedy local hand can wander into one.
//
// Canvas, not SVG: the harness drives render(t) imperatively, so a canvas that
// repaints per frame is the natural fit. Theme colours are read live via
// getComputedStyle so the patch inverts with the light/dark toggle.

const VB_W = 520;
const VB_H = 300;
const SCALE = 70; // px per unit edge
const APEX: Pt = [VB_W / 2, VB_H * 0.62]; // shared vertex, gap opens upward

// A mark is one of Penrose's two edge decorations. Single vs double is the type;
// the rule is that a shared edge must carry the same type from both tiles, with
// the arrows running the same way around the edge. We draw them as 1 or 2 chevrons.
type Mark = "single" | "double";

// One placed tile in the fan: a corner angle seated at the apex, the kind that
// drives its fill colour, and the marks on its two apex-edges (leading, trailing).
// The leading edge of tile n+1 is the trailing edge of tile n, so neighbouring
// marks agree by construction. The conflict lives only at the open gap.
type FanStep = {
  kind: "thick" | "thin";
  angle: number; // interior corner angle at the apex, degrees
  lead: Mark; // mark on the edge that opens the wedge (counter-clockwise side)
  trail: Mark; // mark on the edge that closes it (clockwise side)
};

// The authored placement. 72 + 36 + 144 + 36 = 288, leaving a 72-degree wedge:
// angularly a perfect thick-rhombus acute corner. Every shared edge matches: the
// trailing mark of each tile equals the leading mark of the next. The fan reads as
// a flawless local construction right up to the last gap.
const FAN: readonly FanStep[] = [
  { kind: "thick", angle: 72, lead: "double", trail: "single" },
  { kind: "thin", angle: 36, lead: "single", trail: "single" },
  { kind: "thin", angle: 144, lead: "single", trail: "double" },
  { kind: "thin", angle: 36, lead: "double", trail: "single" },
];

const FAN_TOTAL = FAN.reduce((s, f) => s + f.angle, 0); // 288
const GAP_ANGLE = 360 - FAN_TOTAL; // 72: a legal corner angle, yet unfillable

// Orient the fan so its open wedge points straight up at the reader. Canvas y grows
// downward, so "up" is -90 degrees and we lay the fan clockwise from the gap's edge.
const GAP_CENTER = -90;
const FAN_START = GAP_CENTER + GAP_ANGLE / 2;

// Geometry of the gap's two flanks. The fan's last trailing edge and its very first
// leading edge bound the wedge. To fill 72 degrees you need a thick acute corner,
// whose two edges must carry one single and one double mark in a fixed order. The
// flanks here are double (clockwise flank) and double (counter-clockwise flank):
// two doubles, so the thick corner cannot orient to satisfy both. That is the
// dead-end. It is never the angle; it is always the marks.
const GAP_FLANK_CW: Mark = "double"; // trailing mark of the last tile
const GAP_FLANK_CCW: Mark = "double"; // leading mark of the first tile

const deg = (d: number) => (d * Math.PI) / 180;

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Colors = { thick: string; thin: string; grout: string; ink: string };

// Draw one to two chevrons centred on an edge, pointing along it. The chevron count
// is the mark type (single / double); the direction is the edge orientation. These
// are the matching arrows Penrose tiles carry. Drawn in ink, small, restrained.
function drawMark(
  ctx: CanvasRenderingContext2D,
  a: Pt,
  b: Pt,
  mark: Mark,
  ink: string,
  alpha: number,
) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const wing = 5; // chevron half-width in px
  const sep = 4; // spacing between the two strokes of a double
  const count = mark === "double" ? 2 : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < count; i++) {
    const off = count === 1 ? 0 : (i === 0 ? -sep / 2 : sep / 2);
    const cx = mx + ux * off;
    const cy = my + uy * off;
    // tip points along (ux, uy); the two wings fall back and out.
    const tipx = cx + ux * wing;
    const tipy = cy + uy * wing;
    const baseAx = cx - ux * wing + -uy * wing;
    const baseAy = cy - uy * wing + ux * wing;
    const baseBx = cx - ux * wing - -uy * wing;
    const baseBy = cy - uy * wing - ux * wing;
    ctx.beginPath();
    ctx.moveTo(baseAx, baseAy);
    ctx.lineTo(tipx, tipy);
    ctx.lineTo(baseBx, baseBy);
    ctx.stroke();
  }
  ctx.restore();
}

function fillTile(
  ctx: CanvasRenderingContext2D,
  corners: readonly [Pt, Pt, Pt, Pt],
  fill: string,
  ink: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(corners[0][0], corners[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i][0], corners[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.restore();
}

// smoothstep for gentle per-tile fade-ins.
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Paint the whole patch at normalised time t. The fan animates in over the first
// 0.8 of t (one tile per slice), then the gap is highlighted and, in the final
// stretch, struck through and marked as a conflict. At t = 1 the harness shows the
// stuck end state, stationary: the representative frame for reduced motion.
function paint(ctx: CanvasRenderingContext2D, t: number, colors: Colors) {
  const { thick, thin, grout, ink } = colors;
  ctx.clearRect(0, 0, VB_W, VB_H);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, VB_W, VB_H);

  // Precompute each tile's placed corners and its two apex-edge endpoints.
  const placed = FAN.map((step, i) => {
    const start = FAN_START + FAN.slice(0, i).reduce((s, f) => s + f.angle, 0);
    const raw = fanTile(step.angle, start, [0, 0]);
    const corners = raw.map(
      ([x, y]) => [APEX[0] + x * SCALE, APEX[1] + y * SCALE] as Pt,
    ) as unknown as readonly [Pt, Pt, Pt, Pt];
    return { step, corners, start };
  });

  const PLACE_END = 0.8; // tiles all down by t = 0.8
  const per = PLACE_END / FAN.length;

  // Tiles, one at a time, with their matching marks. A tile's leading edge is
  // apex->corner[1]; trailing edge is apex->corner[3].
  placed.forEach(({ step, corners }, i) => {
    const appear = smooth(i * per, (i + 1) * per, t);
    if (appear <= 0) return;
    const fill = step.kind === "thick" ? thick : thin;
    fillTile(ctx, corners, fill, ink, appear);
    // Marks fade in just behind the fill so the rule is visibly obeyed as we lay.
    const markAlpha = smooth(i * per + per * 0.4, (i + 1) * per, t) * 0.9;
    if (markAlpha > 0) {
      drawMark(ctx, corners[0], corners[1], step.lead, ink, markAlpha);
      drawMark(ctx, corners[0], corners[3], step.trail, ink, markAlpha);
    }
  });

  // The gap. Its two flanks are the first tile's leading edge and the last tile's
  // trailing edge. Highlight the open wedge, then strike it and warn.
  const first = placed[0];
  const last = placed[placed.length - 1];
  const ccwTip = first.corners[1]; // first leading edge tip
  const cwTip = last.corners[3]; // last trailing edge tip

  const gapReveal = smooth(PLACE_END, 0.9, t);
  if (gapReveal > 0) {
    // Hatch the wedge in ink at low opacity: the slot that "should" take a tile.
    ctx.save();
    ctx.globalAlpha = gapReveal * 0.12;
    ctx.beginPath();
    ctx.moveTo(APEX[0], APEX[1]);
    ctx.lineTo(ccwTip[0], ccwTip[1]);
    // arc the outer edge of the wedge for a clean slice
    const r = SCALE;
    const a0 = deg(GAP_CENTER + GAP_ANGLE / 2);
    const a1 = deg(GAP_CENTER - GAP_ANGLE / 2);
    ctx.arc(APEX[0], APEX[1], r, a0, a1, true);
    ctx.closePath();
    ctx.fillStyle = ink;
    ctx.fill();
    ctx.restore();

    // The two conflicting flank marks, both double. The eye reads two arrowheads
    // crowding the same wedge, with nothing legal that satisfies both.
    drawMark(ctx, APEX, ccwTip, GAP_FLANK_CCW, ink, gapReveal);
    drawMark(ctx, APEX, cwTip, GAP_FLANK_CW, ink, gapReveal);
  }

  // The conflict mark: a struck-through gap and a warning glyph, in the final
  // stretch. This is the representative end state at t = 1.
  const strike = smooth(0.9, 1, t);
  if (strike > 0) {
    ctx.save();
    ctx.globalAlpha = strike;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    // an X struck across the wedge mouth
    const r = SCALE * 0.92;
    const mid = deg(GAP_CENTER);
    const mx = APEX[0] + Math.cos(mid) * r;
    const my = APEX[1] + Math.sin(mid) * r;
    const span = 13;
    ctx.beginPath();
    ctx.moveTo(mx - span, my - span);
    ctx.lineTo(mx + span, my + span);
    ctx.moveTo(mx + span, my - span);
    ctx.lineTo(mx - span, my + span);
    ctx.stroke();

    // "no tile fits" caption above the struck gap, mono, ink.
    ctx.globalAlpha = strike * 0.9;
    ctx.fillStyle = ink;
    ctx.font =
      "11px ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("NO LEGAL TILE", mx, my - 22);
    ctx.restore();
  }
}

export default function DeadEnd() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<Colors>({
    thick: "#C89B3C",
    thin: "#3E6B7C",
    grout: "#0f0e0c",
    ink: "#ede9d8",
  });

  const dprRef = useRef(0);

  // Size the backing store to the rendered box times the device pixel ratio so the
  // patch is crisp, then work in CSS-pixel coordinates inside the viewBox. Resizing
  // clears the canvas, so only do it when the ratio actually changes, not per frame.
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
      paint(ctx, t, colorsRef.current);
    },
    [refreshColors],
  );

  // Repaint on theme flip so the stationary end state inverts with the toggle. The
  // harness owns the clock; here we only refresh colours and redraw the end state.
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
      label="sketch 02 · the dead-end"
      animation={{ duration: 5200, render, slider: { label: "lay" } }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "auto", aspectRatio: `${VB_W} / ${VB_H}` }}
        className="block w-full bg-paper"
        role="img"
        aria-label="A fan of Penrose rhombi laid one at a time around a shared vertex, each obeying the edge-matching marks. The last 72-degree wedge is angularly a legal thick-rhombus corner, but its two flanking marks conflict, so no tile can be placed. The gap is struck through and marked no legal tile."
      />
    </Sketch>
  );
}
