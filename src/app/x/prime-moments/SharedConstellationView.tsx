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
  const instanceCount = instances.length;

  return (
    <>
      <h1 className="text-[40px] sm:text-[56px] font-bold leading-[0.95] tracking-[-0.04em] mb-7">
        Prime
        <br />
        Moments
      </h1>

      <p className="text-[18px] leading-[1.45] opacity-85 max-w-[38ch] mb-7">
        Constellation{" "}
        <span className="font-mono">[{offsets.join(", ")}]</span>
      </p>

      {instanceCount > 0 && (
        <div className="flex justify-center mb-8">
          <ConstellationRing
            instances={instances}
            highlightedInstance={hoveredInstance}
            className="w-[200px] h-[200px] sm:w-[260px] sm:h-[260px]"
          />
        </div>
      )}

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
                <div className="text-[14px]">
                  Ages:{" "}
                  <span className="font-mono font-bold">
                    {ages.join(", ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
