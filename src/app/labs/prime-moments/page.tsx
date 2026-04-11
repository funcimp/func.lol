import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

import { isAdmissibleConstellation, isPrime } from "./lib/primes";
import { parseShareParam } from "./lib/share";
import PrimeMomentsFinder from "./PrimeMomentsFinder";
import SharedConstellation from "./SharedConstellation";

export const metadata: Metadata = {
  title: "Prime Moments — func.lol",
  description:
    "Find the calendar windows when every person in a group has a prime age at the same time.",
};

const RESEARCH_URL =
  "https://github.com/funcimp/func.lol/tree/main/research/prime-moments";

const TOUPS_PRIMES = new Set([11, 41, 43, 29, 59, 61, 71, 73, 101, 103]);

type CellKind = "prime" | "toups" | "none";

const NL_CELL_CLASS: Record<CellKind, string> = {
  none: "nl-cell",
  prime: "nl-cell prime",
  toups: "nl-cell toups",
};

// Precomputed at import time — the 1..122 cell labels never change.
const NUMBER_LINE_CELLS: CellKind[] = Array.from({ length: 122 }, (_, i) => {
  const n = i + 1;
  if (TOUPS_PRIMES.has(n)) return "toups";
  if (isPrime(n)) return "prime";
  return "none";
});

function PrimeMomentsEmblem() {
  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      className="w-[72px] h-[72px] sm:w-[96px] sm:h-[96px] flex-shrink-0"
      role="img"
      aria-label="Prime Moments [0, 30, 32] constellation"
    >
      <defs>
        <pattern id="pm-emblem-dot" width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.6" fill="currentColor" />
        </pattern>
      </defs>
      <circle cx="14" cy="72" r="6" fill="currentColor" />
      <circle cx="62" cy="36" r="6" fill="currentColor" />
      <circle cx="80" cy="30" r="6" fill="currentColor" />
      <line x1="14" y1="72" x2="62" y2="36" stroke="currentColor" strokeWidth="0.7" />
      <line x1="14" y1="72" x2="80" y2="30" stroke="currentColor" strokeWidth="0.7" />
      <line x1="62" y1="36" x2="80" y2="30" stroke="currentColor" strokeWidth="0.7" />
      <path d="M 14 72 L 62 36 L 80 30 Z" fill="url(#pm-emblem-dot)" opacity="0.7" />
    </svg>
  );
}

function NumberLine() {
  return (
    <figure className="my-8">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-[0.55] mb-2 flex justify-between">
        <span>primes under 122</span>
        <span>solid = toups primes</span>
      </div>
      <div className="number-line">
        {NUMBER_LINE_CELLS.map((kind, i) => (
          <div key={i} className={NL_CELL_CLASS[kind]} />
        ))}
      </div>
      <div className="font-mono text-[10px] opacity-[0.55] mt-1 flex justify-between">
        <span>1</span>
        <span>30</span>
        <span>60</span>
        <span>90</span>
        <span>122</span>
      </div>
    </figure>
  );
}

interface PageProps {
  searchParams: Promise<{ share?: string | string[] }>;
}

export default async function PrimeMomentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parsed = parseShareParam(params.share);
  const sharedOffsets =
    parsed !== null && isAdmissibleConstellation(parsed) ? parsed : null;

  return (
    <main className="min-h-screen px-6 py-12 sm:px-16 sm:py-16">
      <div className="mx-auto max-w-[720px]">
        <div className="flex items-center justify-between mb-7">
          <Link
            href="/labs"
            className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 hover:opacity-100 no-underline"
          >
            ← func imp labs
          </Link>
          <ThemeToggle />
        </div>

        {sharedOffsets !== null ? (
          <SharedConstellation offsets={sharedOffsets} />
        ) : (
          <>
            <div className="flex items-start justify-between gap-6 mb-7">
              <h1 className="text-[40px] sm:text-[56px] font-bold leading-[0.95] tracking-[-0.04em]">
                Prime
                <br />
                Moments
              </h1>
              <PrimeMomentsEmblem />
            </div>

            <p className="text-[18px] leading-[1.45] opacity-85 max-w-[38ch] mb-7">
              Calendar windows when every person in a group has a prime age at the
              same time.
            </p>

            <div className="font-mono text-[11px] uppercase tracking-[0.12em] opacity-[0.55] flex gap-5 mb-9">
              <span>lab 01</span>
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

            <NumberLine />

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
