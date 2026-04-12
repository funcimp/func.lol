"use client";

import { useState } from "react";

import { isPrime } from "./lib/primes";

const TOUPS_INSTANCES = [
  [11, 41, 43],
  [29, 59, 61],
  [41, 71, 73],
  [71, 101, 103],
];

// Map each Toups prime → which instance indices it belongs to.
const PRIME_INSTANCES: Record<number, number[]> = {};
for (let i = 0; i < TOUPS_INSTANCES.length; i++) {
  for (const p of TOUPS_INSTANCES[i]) {
    (PRIME_INSTANCES[p] ??= []).push(i);
  }
}

const COLORS = [
  "var(--color-moment-1)",
  "var(--color-moment-2)",
  "var(--color-moment-3)",
  "var(--color-moment-4)",
];

function cellStyle(
  n: number,
  hovered: number | null,
): React.CSSProperties | undefined {
  const instances = PRIME_INSTANCES[n];
  if (!instances) return undefined;

  const isActive = hovered === null || instances.includes(hovered);
  const opacity = isActive ? 1 : 0.15;

  if (instances.length === 1) {
    return {
      background: COLORS[instances[0]],
      opacity,
      transition: "opacity 0.15s",
    };
  }
  return {
    background: `linear-gradient(to bottom, ${COLORS[instances[0]]} 50%, ${COLORS[instances[1]]} 50%)`,
    opacity,
    transition: "opacity 0.15s",
  };
}

export default function ToupsNumberLine() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <figure className="my-8">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-[0.55] mb-2 flex justify-between">
        <span>primes under 120</span>
        <span>color = toups primes</span>
      </div>
      <div className="number-line">
        {Array.from({ length: 120 }, (_, i) => {
          const n = i + 1;
          const isToups = n in PRIME_INSTANCES;
          const className = !isToups && isPrime(n) ? "nl-cell prime" : "nl-cell";
          return (
            <div
              key={i}
              className={className}
              style={cellStyle(n, hovered)}
            />
          );
        })}
      </div>
      <div className="font-mono text-[10px] opacity-[0.55] mt-1 flex justify-between">
        <span>1</span>
        <span>30</span>
        <span>60</span>
        <span>90</span>
        <span>120</span>
      </div>

      <div className="flex flex-col gap-0 mt-3">
        {TOUPS_INSTANCES.map((ages, i) => (
          <div
            key={i}
            className="flex items-center gap-2 py-1.5 cursor-default"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="w-[8px] h-[8px] rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[i] }}
            />
            <span className="font-mono text-[11px]">
              ({ages.join(", ")})
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}
