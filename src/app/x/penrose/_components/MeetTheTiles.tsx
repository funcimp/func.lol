"use client";

import { useState } from "react";

import Sketch from "./Sketch";
import { PHI, THICK, THIN, type Pt, type Rhombus } from "./lib/tiles";

// "Meet the two tiles": the first spine sketch. Two unit-edge Penrose rhombi side
// by side, filled in the B1 palette on the paper grout, edges in ink. The static
// labelled state stands alone (enough for touch); hover surfaces the angle detail
// and the golden-ratio fact for the rhombus under the cursor.
//
// SVG, not canvas: this is a static labelled figure, so the markup is the simplest
// way to place text at geometric points and to get theme reactivity for free (the
// fills are CSS var() references that invert with data-theme, no repaint loop).

const VB_W = 520;
const VB_H = 300;
const SCALE = 88; // px per unit edge inside the viewBox

// Lay each rhombus in its own half of the viewBox. The geometry from lib/tiles is
// origin-centred and unit-edge; place() scales it and drops it at a center point.
function place(tile: Rhombus, cx: number, cy: number): Pt[] {
  return tile.corners.map(([x, y]) => [cx + x * SCALE, cy - y * SCALE]);
}

const pointsAttr = (pts: Pt[]) => pts.map(([x, y]) => `${x},${y}`).join(" ");

type TileFigureProps = {
  tile: Rhombus;
  cx: number;
  cy: number;
  fill: string;
  active: boolean;
  dimmed: boolean;
  onEnter: () => void;
  onLeave: () => void;
};

function TileFigure({
  tile,
  cx,
  cy,
  fill,
  active,
  dimmed,
  onEnter,
  onLeave,
}: TileFigureProps) {
  const pts = place(tile, cx, cy);
  const [right, top, left, bottom] = pts;

  // The acute angle sits at the left/right (x-axis) corners; the obtuse at
  // top/bottom. Label one of each.
  return (
    <g
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        opacity: dimmed ? 0.35 : 1,
        transition: "opacity 0.15s ease",
        cursor: "default",
      }}
    >
      <polygon
        points={pointsAttr(pts)}
        fill={fill}
        stroke="var(--color-ink)"
        strokeWidth={active ? 2.5 : 1.5}
        strokeLinejoin="round"
        style={{ transition: "stroke-width 0.15s ease" }}
      />

      {/* Long diagonal, dashed in ink, revealed on hover. This is the line whose
          length carries phi (thick) or 1/phi (thin). */}
      {active && (
        <line
          x1={left[0]}
          y1={left[1]}
          x2={right[0]}
          y2={right[1]}
          stroke="var(--color-ink)"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.6}
        />
      )}

      {/* Acute angle label at the right corner, obtuse at the top corner. */}
      <text
        x={right[0] + 8}
        y={right[1] - 8}
        className="font-mono"
        fontSize={13}
        fill="var(--color-ink)"
        opacity={0.85}
      >
        {tile.acute}&#176;
      </text>
      <text
        x={top[0]}
        y={top[1] - 10}
        textAnchor="middle"
        className="font-mono"
        fontSize={13}
        fill="var(--color-ink)"
        opacity={0.85}
      >
        {tile.obtuse}&#176;
      </text>

      {/* Tile name beneath. */}
      <text
        x={cx}
        y={bottom[1] + 26}
        textAnchor="middle"
        className="font-mono"
        fontSize={11}
        letterSpacing="0.12em"
        fill="var(--color-ink)"
        opacity={0.55}
      >
        {tile.kind === "thick" ? "THICK" : "THIN"}
      </text>
    </g>
  );
}

export default function MeetTheTiles() {
  const [hover, setHover] = useState<"thick" | "thin" | null>(null);

  const detail =
    hover === "thick"
      ? `Thick rhombus. Angles ${THICK.acute}° and ${THICK.obtuse}°. With a unit edge its long diagonal is exactly φ ≈ ${PHI.toFixed(3)}.`
      : hover === "thin"
        ? `Thin rhombus. Angles ${THIN.acute}° and ${THIN.obtuse}°. With a unit edge its short diagonal is exactly 1/φ ≈ ${(1 / PHI).toFixed(3)}.`
        : "Hover a tile to reveal its diagonal. The angle family 36 / 72 / 108 / 144 is the golden ratio in disguise.";

  return (
    <Sketch label="sketch 01 · meet the two tiles">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="block w-full h-auto bg-paper"
        role="img"
        aria-label="Two Penrose rhombi side by side: a thick rhombus with 72 and 108 degree angles, and a thin rhombus with 36 and 144 degree angles"
      >
        <TileFigure
          tile={THICK}
          cx={VB_W * 0.3}
          cy={VB_H * 0.46}
          fill="var(--color-penrose-thick)"
          active={hover === "thick"}
          dimmed={hover === "thin"}
          onEnter={() => setHover("thick")}
          onLeave={() => setHover(null)}
        />
        <TileFigure
          tile={THIN}
          cx={VB_W * 0.72}
          cy={VB_H * 0.46}
          fill="var(--color-penrose-thin)"
          active={hover === "thin"}
          dimmed={hover === "thick"}
          onEnter={() => setHover("thin")}
          onLeave={() => setHover(null)}
        />
      </svg>
      <p
        aria-live="polite"
        className="border-t border-ink px-3 py-2.5 text-[13px] leading-[1.5] min-h-[3.2em]"
      >
        {detail}
      </p>
    </Sketch>
  );
}
