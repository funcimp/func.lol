import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Penrose — func.lol",
  description:
    "An interactive Penrose tiling explorer, addressed exactly at any size via the de Bruijn pentagrid construction.",
};

const RESEARCH_URL =
  "https://github.com/funcimp/func.lol/tree/main/research/penrose";

export default function PenrosePage() {
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

        <header className="mb-9">
          <h1 className="text-[40px] sm:text-[56px] font-bold leading-[0.95] tracking-[-0.04em]">
            penrose
          </h1>
          <p className="text-[18px] leading-[1.45] opacity-85 max-w-[42ch] mt-3">
            An infinite Penrose tiling, addressed exactly at any size via the de Bruijn pentagrid construction.
          </p>
        </header>

        <p className="text-[16px] leading-[1.65] mb-4">
          Penrose&apos;s P3 tiles the plane aperiodically using two rhombi. The de Bruijn pentagrid construction lets us assign every tile a unique integer 5-tuple address. The explorer is built so that address is exact at any magnitude — pan until your wrist gives out, and the coord under the cursor is still the right one.
        </p>

        <div className="my-8">
          <Link
            href="/x/penrose/explore"
            className="inline-block font-mono text-[12px] uppercase tracking-[0.14em] border border-ink px-4 py-2 no-underline hover:bg-ink hover:text-paper transition-colors"
          >
            open explorer →
          </Link>
        </div>

        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-50 mb-4 mt-12">
          research
        </h2>
        <p className="text-[16px] leading-[1.65] mb-4">
          Five substrate questions decided before any explorer code landed: precision drift of Float64 vs BigInt, URL share-link encoding, enumeration throughput, the BigInt-truth / Float64-view viewport-anchor pattern, and a Go comparison. The findings inform every choice in <code>lib/pentagrid.ts</code>.
        </p>
        <a
          href={RESEARCH_URL}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[12px] uppercase tracking-[0.14em] underline"
        >
          research on github →
        </a>
      </div>
    </main>
  );
}
