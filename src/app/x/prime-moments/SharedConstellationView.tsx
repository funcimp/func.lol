"use client";

import { useState } from "react";

import ConstellationRing from "./ConstellationRing";

interface Props {
  offsets: number[];
  instances: number[][];
}

export default function SharedConstellationView({
  offsets,
  instances,
}: Props) {
  const [hoveredInstance, setHoveredInstance] = useState<number | null>(null);
  const n = offsets.length;
  const instanceCount = instances.length;

  return (
    <>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-[0.55] mb-5">
        someone shared a prime constellation
      </div>

      {instanceCount > 0 && (
        <div className="flex justify-center mb-8">
          <ConstellationRing
            instances={instances}
            highlightedInstance={hoveredInstance}
            className="w-[200px] h-[200px] sm:w-[260px] sm:h-[260px]"
          />
        </div>
      )}

      <h1 className="text-[28px] sm:text-[40px] font-bold leading-[1] tracking-[-0.03em] mb-2">
        a group of {n}
      </h1>
      <div className="font-mono text-[12px] opacity-70 mb-8">
        constellation [{offsets.join(", ")}]
      </div>

      <div className="mb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-[0.55] mb-2">
          {instanceCount === 0
            ? "no lifetime instances"
            : `this constellation has ${instanceCount} moment${instanceCount === 1 ? "" : "s"} in a human lifespan`}
        </div>
        {instanceCount > 0 && (
          <div className="flex flex-col">
            {instances.map((ages, i) => (
              <div
                key={i}
                className="border-t border-ink py-3 grid grid-cols-[8px_1fr] gap-4 items-center cursor-default"
                onMouseEnter={() => setHoveredInstance(i)}
                onMouseLeave={() => setHoveredInstance(null)}
              >
                <div
                  className="w-[8px] h-[8px] rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: `var(--color-moment-${(i % 4) + 1})`,
                  }}
                />
                <div className="font-mono text-[13px]">
                  ({ages.join(", ")})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
