// Share view for a shared Prime Moments constellation.
//
// Pure server component. Given validated offsets, computes the
// lifetime instances from math alone (no group data) and renders the
// emblem-forward share view layout.
//
// Slots inside the lab page's main wrapper — the crumb row, toggle,
// and max-width container belong to page.tsx, not this component.

import Link from "next/link";

import ConstellationEmblem from "./ConstellationEmblem";
import { findLifetimeInstances } from "./lib/primeMoments";

interface Props {
  offsets: number[];
}

export default function SharedConstellation({ offsets }: Props) {
  const instances = findLifetimeInstances(offsets);
  const n = offsets.length;
  const instanceCount = instances.length;

  return (
    <>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-[0.55] mb-5">
        someone shared a prime constellation
      </div>

      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-[28px] sm:text-[40px] font-bold leading-[1] tracking-[-0.03em] mb-2">
            a group of {n}
          </h1>
          <div className="font-mono text-[12px] opacity-70">
            constellation [{offsets.join(", ")}]
          </div>
        </div>
        <ConstellationEmblem
          offsets={offsets}
          className="w-[72px] h-[72px] sm:w-[96px] sm:h-[96px] flex-shrink-0 text-ink"
        />
      </div>

      <div className="mb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-[0.55] mb-2">
          {instanceCount} lifetime instance{instanceCount === 1 ? "" : "s"}
        </div>
        {instanceCount === 0 ? (
          <p className="text-[14px] opacity-70">
            This constellation has no all-prime instances within a human
            lifespan.
          </p>
        ) : (
          <div className="font-mono text-[13px] leading-[1.8] break-words">
            {instances.map((ages, i) => (
              <span key={i}>
                {i > 0 && " · "}({ages.join(", ")})
              </span>
            ))}
          </div>
        )}
      </div>

      <Link
        href="/labs/prime-moments"
        className="inline-block font-mono text-[12px] lowercase tracking-[0.04em] px-4 py-2 bg-ink text-paper border border-ink no-underline hover:opacity-90"
      >
        try your own →
      </Link>
    </>
  );
}
