import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

import { isAdmissibleConstellation } from "./lib/primes";
import { parseShareParam } from "./lib/share";
import PrimeMomentsFinder from "./PrimeMomentsFinder";
import SharedConstellation from "./SharedConstellation";
import ToupsNumberLine from "./ToupsNumberLine";

export const metadata: Metadata = {
  title: "Prime Moments — func.lol",
  description:
    "Find the calendar windows when every person in a group has a prime age at the same time.",
};

const RESEARCH_URL =
  "https://github.com/funcimp/func.lol/tree/main/research/prime-moments";

interface PageProps {
  searchParams: Promise<{ s?: string | string[] }>;
}

export default async function PrimeMomentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parsed = parseShareParam(params.s);
  const sharedOffsets =
    parsed !== null && isAdmissibleConstellation(parsed) ? parsed : null;

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

        {sharedOffsets !== null ? (
          <SharedConstellation offsets={sharedOffsets} />
        ) : (
          <>
            <h1 className="text-[40px] sm:text-[56px] font-bold leading-[0.95] tracking-[-0.04em] mb-7">
              Prime
              <br />
              Moments
            </h1>

            <p className="text-[18px] leading-[1.45] opacity-85 max-w-[38ch] mb-7">
              Calendar windows when every person in a group has a prime age at the
              same time.
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
                My family hit one of these recently. Sarah just turned 41, and
                before her next birthday I&rsquo;ll turn 43 and Lyra will turn 11.
                Three ages, all prime, all at once: <strong>11, 41, 43</strong>.
              </p>
              <p>
                The interesting part isn&rsquo;t the moment itself &mdash; it&rsquo;s
                that the same shape repeats. The offsets <code>[0, 30, 32]</code>
                hit prime triples at <code>(11, 41, 43)</code>, then again at{" "}
                <code>(29, 59, 61)</code>, <code>(41, 71, 73)</code>, and{" "}
                <code>(71, 101, 103)</code>. A single human family can pass through
                this configuration four times in one lifetime. I started calling
                these <strong>Toups Primes</strong>.
              </p>
            </div>

            <ToupsNumberLine />

            <div className="prose-hyphens flex flex-col gap-4 text-[16px] leading-[1.65] max-w-[60ch]">
              <p>
                A <em>prime constellation</em> is the offset shape. A{" "}
                <em>prime moment</em> is what happens when real people with real
                birthdays line up with one of those shapes on the calendar.
              </p>
              <p className="text-[16px] opacity-70">
                Footnote on 2: 2 is the only even prime, so any constellation that
                contains it has odd offsets to every other member. Such patterns can
                occur at most once (at base 2) and never repeat. The finder uses
                only odd primes for the recurring patterns &mdash; that&rsquo;s
                where the interesting structure lives.
              </p>
            </div>
          </>
        )}

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
