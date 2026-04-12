import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Experiments — func.lol",
  description: "Experiments by Functionally Imperative.",
};

type Lab = {
  slug: string;
  title: string;
  blurb: string;
  publishedAt: string;
  links?: { substack?: string; youtube?: string; github?: string };
};

const labs: Lab[] = [
  {
    slug: "prime-moments",
    title: "Prime Moments",
    blurb:
      "Find the calendar windows when every person in a group has a prime age at the same time.",
    publishedAt: "2026-04-10",
    links: {
      github: "https://github.com/funcimp/func.lol/tree/main/research/prime-moments",
    },
  },
];

export default function LabsIndexPage() {
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

        <header className="mb-9">
          <h1 className="text-[40px] sm:text-[56px] font-bold leading-[0.95] tracking-[-0.04em]">
            experiments
          </h1>
          <p className="text-[18px] leading-[1.45] opacity-85 max-w-[38ch] mt-3">
            Small, self-contained experiments. Built in public.
          </p>
        </header>

        <ul className="flex flex-col">
          {labs.map((lab) => (
            <li key={lab.slug} className="border-t border-ink last:border-b">
              <Link
                href={`/x/${lab.slug}`}
                className="block py-6 hover:bg-ink/5 transition-colors no-underline"
              >
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <h2 className="text-[28px] font-bold tracking-[-0.03em]">
                    {lab.title}
                  </h2>
                  <time
                    dateTime={lab.publishedAt}
                    className="font-mono text-[11px] uppercase tracking-[0.12em] opacity-55"
                  >
                    {formatDate(lab.publishedAt)}
                  </time>
                </div>
                <p className="opacity-85 mt-2 text-[16px] leading-[1.55] max-w-[60ch]">
                  {lab.blurb}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
