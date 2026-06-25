import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

import DeadEnd from "./_components/DeadEnd";
import MeetTheTiles from "./_components/MeetTheTiles";

export const metadata: Metadata = {
  title: "Penrose — func.lol",
  description:
    "An endless Penrose tiling you can pan forever, generated per viewport, with every tile carrying its exact de Bruijn coordinate.",
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
            A Penrose tiling you can pan forever, every tile carrying its exact coordinate.
          </p>
        </header>

        <p className="text-[16px] leading-[1.65] mb-4">
          Penrose&apos;s P3 tiles the plane aperiodically using two rhombi. There is no edge to reach. The explorer generates whatever patch you are looking at on the fly, so you can pan in any direction forever. Every tile carries its exact de Bruijn coordinate, shown under the cursor, and any view is a link you can share.
        </p>

        <div className="my-8">
          <Link
            href="/x/penrose/explore"
            className="inline-block font-mono text-[12px] uppercase tracking-[0.14em] border border-ink px-4 py-2 no-underline hover:bg-ink hover:text-paper transition-colors"
          >
            open explorer →
          </Link>
        </div>

        <h2 className="text-[24px] sm:text-[32px] font-bold leading-[1] tracking-[-0.03em] mb-6 mt-14">
          Two tiles, one rule
        </h2>

        <div className="prose-hyphens flex flex-col gap-4 text-[16px] leading-[1.65] max-w-[60ch]">
          <p>
            The whole tiling is built from two shapes. A <strong>thick</strong>{" "}
            rhombus, wide and squat, and a <strong>thin</strong> one, long and
            narrow. Same edge length, different angles. Every tile in the
            explorer is one of these two, rotated and placed.
          </p>
          <p>
            The angles are not arbitrary. They come from fifths of a turn: 36,
            72, 108, 144. That family is the golden ratio φ in disguise. Draw the
            long diagonal of the thick rhombus and its length is exactly φ;
            draw the short diagonal of the thin one and it is exactly 1/φ. φ is
            why these two tiles fit the plane with no repeat.
          </p>
        </div>

        <MeetTheTiles />

        <h2 className="text-[24px] sm:text-[32px] font-bold leading-[1] tracking-[-0.03em] mb-6 mt-14">
          The dead-end
        </h2>

        <div className="prose-hyphens flex flex-col gap-4 text-[16px] leading-[1.65] max-w-[60ch]">
          <p>
            Each edge carries a mark, a single or double arrow. The rule is local:
            two tiles may touch only where their marks agree. Obey it and a tile
            fits its neighbor. So you lay one, then the next, then the next, around
            a shared corner, every join clean.
          </p>
          <p>
            Penrose once spotted a university floor whose edge tile broke the rule.
            He knew at a glance the pattern would go wrong somewhere in the middle
            of the lawn. Here is that wrongness up close. The last wedge is a
            perfect 72 degrees, exactly a thick rhombus&apos;s sharp corner. The
            angle is fine. But the two marks flanking it demand opposite things, so
            no tile can seat there. The patch is stuck.
          </p>
          <p>
            The rules are local. Local is not enough. Somewhere far from where you
            started, it can become impossible. That is why the explorer never lays
            tiles by these marks at all. It projects each patch from a 5D lattice,
            where the whole tiling is one shadow and a dead-end cannot exist.
          </p>
        </div>

        <DeadEnd />

        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-50 mb-4 mt-12">
          research
        </h2>
        <p className="text-[16px] leading-[1.65] mb-4">
          Five substrate questions decided before any explorer code landed: precision drift of Float64 vs BigInt, URL share-link encoding, enumeration throughput, the BigInt-truth / Float64-view viewport-anchor pattern, and a Go comparison. The findings inform the engine and its addressing.
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
