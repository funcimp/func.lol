"use client";

import { isPrime } from "./lib/primes";

// 120-position ring. Each age = exactly 3°. Primes ≤ 119 get dots.
// Constellation instances are drawn as colored polygons.

const CX = 60;
const CY = 60;
const RADIUS = 46;
const RING_MAX = 120;

const INSTANCE_COLORS = [
  "var(--color-moment-1)",
  "var(--color-moment-2)",
  "var(--color-moment-3)",
  "var(--color-moment-4)",
];

// Precompute the 30 primes that appear on the ring.
const RING_PRIMES: number[] = [];
for (let n = 2; n < RING_MAX; n++) {
  if (isPrime(n)) RING_PRIMES.push(n);
}

function primePosition(p: number): { x: number; y: number } {
  const angle = (p * Math.PI) / 60 - Math.PI / 2;
  return {
    x: CX + RADIUS * Math.cos(angle),
    y: CY + RADIUS * Math.sin(angle),
  };
}

interface ConstellationRingProps {
  instances: number[][];
  highlightedInstance?: number | null;
  className?: string;
}

export default function ConstellationRing({
  instances,
  highlightedInstance = null,
  className,
}: ConstellationRingProps) {
  const hasHighlight = highlightedInstance !== null;

  return (
    <svg
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Prime constellation ring"
    >
      {/* Ring outline */}
      <circle
        cx={CX}
        cy={CY}
        r={RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.2}
        opacity={0.12}
      />

      {/* Ghost dots — one per prime ≤ 119 */}
      {RING_PRIMES.map((p) => {
        const { x, y } = primePosition(p);
        return (
          <circle
            key={`ghost-${p}`}
            cx={x}
            cy={y}
            r={1.0}
            fill="currentColor"
            opacity={0.3}
          />
        );
      })}

      {/* Instance polygons + vertex dots */}
      {instances.map((ages, i) => {
        const color = INSTANCE_COLORS[i % INSTANCE_COLORS.length];
        const isActive = highlightedInstance === i;
        const isFaded = hasHighlight && !isActive;

        const positions = ages.map((p) => primePosition(p));
        const points = positions
          .map((pos) => `${pos.x.toFixed(2)},${pos.y.toFixed(2)}`)
          .join(" ");

        const fillOpacity = isActive ? 0.25 : isFaded ? 0.05 : 0.14;
        const strokeOpacity = isActive ? 1.0 : isFaded ? 0.2 : 0.88;
        const dotOpacity = isFaded ? 0.25 : 1;

        return (
          <g key={i} style={{ transition: "opacity 0.15s ease" }}>
            {ages.length >= 3 && (
              <polygon
                points={points}
                fill={color}
                fillOpacity={fillOpacity}
                stroke={color}
                strokeWidth={0.8}
                strokeOpacity={strokeOpacity}
                style={{ transition: "fill-opacity 0.15s, stroke-opacity 0.15s" }}
              />
            )}
            {ages.length === 2 && (
              <line
                x1={positions[0].x}
                y1={positions[0].y}
                x2={positions[1].x}
                y2={positions[1].y}
                stroke={color}
                strokeWidth={0.8}
                strokeOpacity={strokeOpacity}
                style={{ transition: "stroke-opacity 0.15s" }}
              />
            )}
            {positions.map((pos, j) => (
              <circle
                key={j}
                cx={pos.x}
                cy={pos.y}
                r={2.2}
                fill={color}
                opacity={dotOpacity}
                style={{ transition: "opacity 0.15s" }}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
