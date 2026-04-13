import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

import ConstellationRing from "./ConstellationRing";
import { findLifetimeInstances } from "./lib/primeMoments";
import PrimeMomentsFinder from "./PrimeMomentsFinder";
import ToupsNumberLine from "./ToupsNumberLine";

export const metadata: Metadata = {
  title: "Prime Moments — func.lol",
  description: "See how many prime moments exist for a given group of people.",
};

const RESEARCH_URL =
  "https://github.com/funcimp/func.lol/tree/main/research/prime-moments";

export default function PrimeMomentsPage() {
  return (
    <main className="min-h-screen px-6 py-12 sm:px-16 sm:py-16">
      <div className="mx-auto max-w-[720px]">
        <div className="flex items-center justify-between mb-7">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 hover:opacity-100 no-underline"
          >
            ← func.lol
          </Link>
          <ThemeToggle />
        </div>

        <h1 className="text-[40px] sm:text-[56px] font-bold leading-[0.95] tracking-[-0.04em] mb-7">
          Prime
          <br />
          Moments
        </h1>

        <p className="text-[18px] leading-[1.45] opacity-85 max-w-[38ch] mb-7">
          Do your family or friends have a prime moment?
        </p>

        <div className="font-mono text-[11px] uppercase tracking-[0.12em] opacity-[0.55] flex gap-5 mb-9">
          <span>experiment 01</span>
          <span>2026-04-10</span>
        </div>

        <div className="mb-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-50 mb-3">
            featured prime moments
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { slug: "1Be", offsets: [0, 30, 32], label: "4 instances" },
                { slug: "1kE", offsets: [0, 30, 36], label: "11 instances" },
                {
                  slug: "16Nk",
                  offsets: [0, 24, 36, 66],
                  label: "7 instances",
                },
              ] as const
            ).map((ex) => (
              <Link
                key={ex.slug}
                href={`/x/prime-moments/${ex.slug}`}
                target="_blank"
                className="border border-ink/20 hover:border-ink/60 p-3 no-underline transition-colors"
              >
                <ConstellationRing
                  instances={findLifetimeInstances([...ex.offsets])}
                  className="w-full aspect-square"
                />
                <div className="mt-2 font-mono text-[10px] opacity-70 leading-tight">
                  [{ex.offsets.join(", ")}]
                </div>
                <div className="font-mono text-[10px] opacity-50 mt-0.5">
                  {ex.label}
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-2 text-right">
            <Link
              href="/x/prime-moments/browse"
              className="font-mono text-[11px] opacity-50 hover:opacity-100 no-underline"
            >
              browse 82,407 more →
            </Link>
          </div>
        </div>

        <div className="dither-box mb-14">
          <PrimeMomentsFinder />
        </div>

        <h2
          id="what-is-a-prime-moment"
          className="text-[24px] sm:text-[32px] font-bold leading-[1] tracking-[-0.03em] mb-6"
        >
          What is a Prime Moment?
        </h2>

        <div className="prose-hyphens flex flex-col gap-4 text-[16px] leading-[1.65] max-w-[60ch]">
          <p>
            My daughter, Lyra, and I were talking about birthdays and prime
            numbers. We realized we&rsquo;d both be prime at the same time, and
            then it hit me that my wife Sarah, Lyra, and I, for a window of time
            would all have prime ages. Lyra at 11, Sarah at 41, me at 43. Three
            primes all at once.
          </p>
          <p>
            That is a <strong>prime moment</strong>.
          </p>
          <p>
            I dug into it. Not only do we have a prime moment, we have four of
            them. The same pattern of ages repeats across our lifetimes:{" "}
            <code>(11, 41, 43)</code>, then <code>(29, 59, 61)</code>, then{" "}
            <code>(41, 71, 73)</code>, and finally <code>(71, 101, 103)</code>.
            The shape is the same every time. I jokingly started calling these{" "}
            <strong>Toups Primes</strong>.
          </p>
          <p>That puzzled me. Why does this repeat?</p>
          <p>
            You might know twin primes. Pairs of primes exactly 2 apart, like 11
            and 13, or 29 and 31. There are infinitely many primes.
            Mathematicians conjecture there are also infinitely many twin primes
            (and by extension, infinitely many Toups Primes).
          </p>
          <p>
            Twin primes are a simple form of a <em>prime constellation</em>: a
            pattern of offsets that produces all-prime tuples. Twins have the
            shape <code>[0, 2]</code>. Pick a prime p. If p+2 is also prime, you
            have a twin. My family&rsquo;s constellation is{" "}
            <code>[0, 30, 32]</code>. Pick a prime p. If p+30 and p+32 are also
            prime, you have a Toups triple. These shapes repeat because the gaps
            define a shape, and that shape can land on different starting
            primes.
          </p>
        </div>

        <ToupsNumberLine />

        <div className="prose-hyphens flex flex-col gap-4 text-[16px] leading-[1.65] max-w-[60ch]">
          <p>
            A <em>prime constellation</em> is a pattern of age gaps that
            produces all-prime tuples. Not every group has one. A{" "}
            <em>prime moment</em> is when real people with real birthdays pass
            through that pattern on the calendar. Some constellations produce a
            single moment, but a large number produce multiple moments.
          </p>
          <p className="text-[16px] opacity-70">
            Footnote on 2: the only even prime. Any constellation that includes
            it can occur at most once and never repeats. The finder uses only
            odd primes for the recurring patterns. That&rsquo;s where the
            interesting structure lives.
          </p>
        </div>

        <div className="mt-14 pt-7 border-t border-ink">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-50 mb-4">
            research
          </h2>
          <div className="flex flex-col gap-4 text-[16px] leading-[1.65] max-w-[60ch]">
            <p>
              I searched every biologically plausible family constellation under
              120. The largest repeating family I found is{" "}
              <Link href="/x/prime-moments/3oXG" className="underline">
                13 members
              </Link>
              , two parents and eleven children, all prime at the same time,
              twice.
            </p>
            <p>
              I plan to keep digging. New findings will show up here. In the
              meantime,{" "}
              <Link href="/x/prime-moments/browse" className="underline">
                browse 82,000+ constellations
              </Link>{" "}
              or{" "}
              <a href="#" className="underline">
                find your own
              </a>
              .
            </p>
            <p>
              <a
                href={RESEARCH_URL}
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                research on github →
              </a>
            </p>
          </div>
        </div>

        <footer className="mt-10 pt-5 border-t border-ink font-mono text-[11px] opacity-55 text-center">
          an experiment by{" "}
          <a
            href="https://n.2p5.xyz"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            nathan toups
          </a>
        </footer>
      </div>
    </main>
  );
}
