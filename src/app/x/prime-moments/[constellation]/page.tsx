import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

import { decodeConstellation } from "../lib/encoding";
import { isAdmissibleConstellation } from "../lib/primes";
import { parseShareParam } from "../lib/share";
import SharedConstellation from "../SharedConstellation";

/**
 * Parse the constellation slug. Accepts:
 * - base62 bitmask (e.g. "4so")
 * - dot-separated offsets (e.g. "0.30.32")
 */
function parseSlug(slug: string): number[] | null {
  // Try dot-separated first (contains a dot).
  if (slug.includes(".")) {
    return parseShareParam(slug);
  }
  // Otherwise try base62 bitmask.
  return decodeConstellation(slug);
}

interface PageProps {
  params: Promise<{ constellation: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { constellation } = await params;
  const offsets = parseSlug(constellation);
  if (offsets && isAdmissibleConstellation(offsets)) {
    return {
      title: `Constellation [${offsets.join(", ")}] — Prime Moments`,
      description: `A prime constellation with offsets [${offsets.join(", ")}]. See when these primes align in a human lifespan.`,
    };
  }
  return { title: "Prime Moments — func.lol" };
}

export default async function ConstellationPage({ params }: PageProps) {
  const { constellation } = await params;
  const offsets = parseSlug(constellation);
  const valid =
    offsets !== null && isAdmissibleConstellation(offsets) ? offsets : null;

  return (
    <main className="min-h-screen px-6 py-12 sm:px-16 sm:py-16">
      <div className="mx-auto max-w-[720px]">
        <div className="flex items-center justify-between mb-7">
          <Link
            href="/x/prime-moments"
            className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 hover:opacity-100 no-underline"
          >
            ← prime moments
          </Link>
          <ThemeToggle />
        </div>

        {valid !== null ? (
          <SharedConstellation offsets={valid} />
        ) : (
          <div>
            <h1 className="text-[28px] font-bold mb-4">
              Invalid constellation
            </h1>
            <p className="text-[14px] opacity-70 mb-6">
              The offsets in this URL don&rsquo;t form a valid prime
              constellation.
            </p>
            <Link
              href="/x/prime-moments"
              className="inline-block font-mono text-[12px] lowercase tracking-[0.04em] px-4 py-2 bg-ink text-paper border border-ink no-underline hover:opacity-90"
            >
              try your own →
            </Link>
          </div>
        )}

        <footer className="mt-14 pt-5 border-t border-ink font-mono text-[11px] opacity-55">
          research →{" "}
          <a
            href="https://github.com/funcimp/func.lol/tree/main/research/prime-moments"
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
