// Programmatic regular-polygon emblem for a constellation. Takes an
// array of offsets and renders N points evenly spaced on a circle,
// connected by lines, with the interior filled by the same stippled
// dither pattern used elsewhere in the lab.
//
// n = 1: single filled dot
// n = 2: line segment with two dots
// n ≥ 3: polygon with all pairwise edges + dither-filled interior
//
// Uses currentColor so it inherits the theme.

import type { SVGProps } from "react";

const VB = 96; // viewBox side length
const CX = VB / 2;
const CY = VB / 2;
const RADIUS = 32; // distance from center to each vertex
const DOT_RADIUS = 5;
const STROKE_WIDTH = 0.7;
const PATTERN_ID = "constellation-emblem-dot";

interface ConstellationEmblemProps
  extends Omit<SVGProps<SVGSVGElement>, "role" | "aria-label"> {
  offsets: number[];
}

export default function ConstellationEmblem({
  offsets,
  ...props
}: ConstellationEmblemProps) {
  const n = offsets.length;

  // Place n vertices evenly around a circle, first at the top (12 o'clock).
  const points = Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return {
      x: CX + RADIUS * Math.cos(angle),
      y: CY + RADIUS * Math.sin(angle),
    };
  });

  // Build the polygon fill path only for n ≥ 3.
  const polygonPath =
    n >= 3
      ? `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")} Z`
      : "";

  // Pairwise edges. For n = 2, one edge; for n ≥ 3, all pairs.
  const edges: Array<[number, number]> = [];
  if (n === 2) {
    edges.push([0, 1]);
  } else if (n >= 3) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        edges.push([i, j]);
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`constellation with ${n} point${n === 1 ? "" : "s"}`}
      {...props}
    >
      <defs>
        <pattern
          id={PATTERN_ID}
          width="3"
          height="3"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1.5" cy="1.5" r="0.6" fill="currentColor" />
        </pattern>
      </defs>
      {n >= 3 && (
        <path
          d={polygonPath}
          fill={`url(#${PATTERN_ID})`}
          opacity="0.7"
        />
      )}
      {edges.map(([i, j]) => (
        <line
          key={`${i}-${j}`}
          x1={points[i].x}
          y1={points[i].y}
          x2={points[j].x}
          y2={points[j].y}
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
        />
      ))}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={DOT_RADIUS}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
