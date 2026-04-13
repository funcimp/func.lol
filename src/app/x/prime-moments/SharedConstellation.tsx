// Share view for a shared Prime Moments constellation.
//
// Server component shell. Computes lifetime instances from offsets,
// then hands off to the client component for interactive rendering.

import Link from "next/link";

import { findLifetimeInstances } from "./lib/primeMoments";
import SharedConstellationView from "./SharedConstellationView";

interface Props {
  offsets: number[];
}

export default function SharedConstellation({ offsets }: Props) {
  const instances = findLifetimeInstances(offsets);

  return (
    <>
      <SharedConstellationView offsets={offsets} instances={instances} />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/x/prime-moments"
          className="inline-block font-mono text-[12px] lowercase tracking-[0.04em] px-4 py-2 bg-ink text-paper border border-ink no-underline hover:opacity-90"
        >
          find your own →
        </Link>
        <Link
          href="/x/prime-moments#what-is-a-prime-moment"
          className="inline-block font-mono text-[12px] lowercase tracking-[0.04em] px-4 py-2 bg-transparent text-ink border border-ink no-underline hover:bg-ink/5"
        >
          what is a prime moment?
        </Link>
        <Link
          href="/x/prime-moments/browse"
          className="inline-block font-mono text-[12px] lowercase tracking-[0.04em] px-4 py-2 bg-transparent text-ink border border-ink no-underline hover:bg-ink/5"
        >
          browse more →
        </Link>
      </div>
    </>
  );
}
