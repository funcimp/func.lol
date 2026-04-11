import type { Metadata } from "next";
import Link from "next/link";

import PrimeMomentsFinder from "./PrimeMomentsFinder";

export const metadata: Metadata = {
  title: "Prime Moments — func.lol",
  description:
    "Find the calendar windows when every member of your family has a prime age at the same time.",
};

const RESEARCH_URL =
  "https://github.com/funcimp/func.lol/tree/main/research/prime-moments";

export default function PrimeMomentsPage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl flex flex-col gap-10">
        <header className="flex flex-col gap-3">
          <Link
            href="/labs"
            className="text-sm opacity-60 hover:opacity-100 transition"
          >
            ← func imp labs
          </Link>
          <h1 className="text-4xl font-bold">Prime Moments</h1>
          <p className="text-lg opacity-80">
            The calendar windows when every member of a family has a prime age
            at the same time.
          </p>
        </header>

        <section className="flex flex-col gap-4 leading-relaxed opacity-90">
          <p>
            My family hit one of these recently. Sarah just turned 41, and
            before her next birthday I&rsquo;ll turn 43 and Lyra will turn 11.
            Three ages, all prime, all at once: <strong>11, 41, 43</strong>.
          </p>
          <p>
            The interesting part isn&rsquo;t the moment itself &mdash;
            it&rsquo;s that the same shape repeats. The offsets{" "}
            <code>[0, 30, 32]</code> hit prime triples at{" "}
            <code>(11, 41, 43)</code>, then again at{" "}
            <code>(29, 59, 61)</code>, <code>(41, 71, 73)</code>, and{" "}
            <code>(71, 101, 103)</code>. A single human family can pass
            through this configuration four times in one lifetime. I started
            calling these <strong>Toups Primes</strong>.
          </p>
          <p>
            A <em>prime constellation</em> is the offset shape. A{" "}
            <em>prime moment</em> is what happens when a real family with
            real birthdays lines up with one of those shapes on the calendar.
            The tool below takes everyone in your family and lists every
            future window when all your ages are simultaneously prime.
          </p>
          <p className="text-sm opacity-70">
            Footnote on 2: 2 is the only even prime, so any constellation that
            contains it has odd offsets to every other member. Such patterns
            can occur at most once (at base 2) and never repeat. The finder
            uses only odd primes for the recurring patterns &mdash; that&rsquo;s
            where the interesting structure lives.
          </p>
        </section>

        <PrimeMomentsFinder />

        <footer className="border-t border-base-300 pt-6 text-sm opacity-70 flex flex-col gap-2">
          <p>
            Read the full research, including the Go enumerator that found
            ~51,000 lifetime-repeatable family constellations:{" "}
            <a
              href={RESEARCH_URL}
              className="link link-hover underline"
              target="_blank"
              rel="noreferrer"
            >
              research/prime-moments on GitHub
            </a>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}
