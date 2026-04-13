import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

import PrimeMomentsFinder from "./PrimeMomentsFinder";
import ToupsNumberLine from "./ToupsNumberLine";

export const metadata: Metadata = {
  title: "Prime Moments — func.lol",
  description:
    "See how many prime moments exist for a given group of people.",
};

const RESEARCH_URL =
  "https://github.com/funcimp/func.lol/tree/main/research/prime-moments";

export default function PrimeMomentsPage() {
  return (
    <main className="min-h-screen px-6 py-12 sm:px-16 sm:py-16">
      <div className="mx-auto max-w-[720px]">
        <div className="flex items-center justify-between mb-7">
          <Link
            href="/x"
            className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 hover:opacity-100 no-underline"
          >
            ← experiments
          </Link>
          <ThemeToggle />
        </div>

        <h1 className="text-[40px] sm:text-[56px] font-bold leading-[0.95] tracking-[-0.04em] mb-7">
          Prime
          <br />
          Moments
        </h1>

        <p className="text-[18px] leading-[1.45] opacity-85 max-w-[38ch] mb-7">
          See how many prime moments your family, friends, or any group will
          share in a lifetime.
        </p>

        <div className="font-mono text-[11px] uppercase tracking-[0.12em] opacity-[0.55] flex gap-5 mb-9">
          <span>experiment 01</span>
          <span>2026-04-10</span>
        </div>

        <div className="mb-14">
          <PrimeMomentsFinder />
        </div>

        <div className="prose-hyphens flex flex-col gap-4 text-[16px] leading-[1.65] max-w-[60ch]">
          <p>
            This started with a conversation about primes. My daughter Lyra and
            I were talking about which ages are prime, and I realized that she
            and I would both be prime at the same time &mdash; and then I
            noticed that all three of us would be. Lyra at 11, Sarah at 41, me
            at 43. Three ages, all prime, all at once.
          </p>
          <p>
            That&rsquo;s a <strong>prime moment</strong>.
          </p>
          <p>
            You&rsquo;ve probably heard of twin primes &mdash; pairs of primes
            that are exactly 2 apart, like 11 and 13, or 29 and 31.
            Mathematicians have studied them for centuries and believe there are
            infinitely many of them, though nobody has proved it yet.
          </p>
          <p>
            Twin primes are the simplest example of a{" "}
            <em>prime constellation</em> &mdash; a pattern of offsets that can
            produce all-prime tuples. Twins have the shape{" "}
            <code>[0, 2]</code>. My family&rsquo;s pattern is{" "}
            <code>[0, 30, 32]</code> &mdash; a base prime, then two more
            primes 30 and 32 steps away. It turns out these shapes have a
            remarkable property: they repeat.
          </p>
          <p>
            The pattern <code>[0, 30, 32]</code> doesn&rsquo;t just work once.
            It hits at <code>(11, 41, 43)</code>, then again at{" "}
            <code>(29, 59, 61)</code>, then <code>(41, 71, 73)</code>, and
            finally <code>(71, 101, 103)</code>. Four times in a single human
            lifespan. I started calling these{" "}
            <strong>Toups Primes</strong>.
          </p>
        </div>

        <ToupsNumberLine />

        <div className="prose-hyphens flex flex-col gap-4 text-[16px] leading-[1.65] max-w-[60ch]">
          <p>
            A <em>prime constellation</em> is the offset shape &mdash; the gaps
            between members. A <em>prime moment</em> is what happens when real
            people with real birthdays actually pass through one of those shapes
            on the calendar. Every group has its own constellation, determined
            by the age gaps between its members, and most constellations repeat
            multiple times in a lifetime.
          </p>
          <p className="text-[16px] opacity-70">
            Footnote on 2: 2 is the only even prime, which makes it a loner.
            Any constellation that includes it has odd offsets to every other
            member &mdash; those patterns can occur at most once and never
            repeat. The finder uses only odd primes for the recurring patterns.
            That&rsquo;s where the interesting structure lives.
          </p>
        </div>

        <footer className="mt-14 pt-5 border-t border-ink font-mono text-[11px] opacity-55">
          research →{" "}
          <a
            href={RESEARCH_URL}
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            github.com/funcimp/func.lol/research/prime-moments
          </a>
        </footer>
      </div>
    </main>
  );
}
