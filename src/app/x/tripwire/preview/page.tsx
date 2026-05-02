// src/app/x/tripwire/preview/page.tsx
//
// Fixture-locked render of the same shared components used on
// /x/tripwire. Useful for design tweaks against a stable dataset (no
// blob round-trip, no live drift). Public URL but not linked, not
// indexed.

import type { Metadata } from "next"
import Link from "next/link"

import ThemeToggle from "@/components/ThemeToggle"
import fixture from "../_fixtures/aggregates.sample.json"
import type { Aggregates } from "@/lib/tripwire/aggregate-shape"
import { Hero, StatsPanel } from "../_components/StatsPanel"

export const metadata: Metadata = {
  title: "Tripwire stats preview",
  robots: { index: false, follow: false },
}

const aggregates = fixture as Aggregates

export default function TripwirePreviewPage() {
  return (
    <main className="min-h-screen px-6 py-12 sm:px-16 sm:py-16">
      <div className="mx-auto max-w-[720px]">
        <div className="flex items-center justify-between mb-7">
          <Link
            href="/x/tripwire"
            className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 hover:opacity-100 no-underline"
          >
            ← tripwire
          </Link>
          <ThemeToggle />
        </div>

        <header className="mb-9">
          <h1 className="text-[40px] sm:text-[56px] font-bold leading-[0.95] tracking-[-0.04em]">
            tripwire / stats preview
          </h1>
          <p className="font-mono text-[13px] opacity-55 mt-3">
            fixture-locked render · same components as /x/tripwire
          </p>
        </header>

        <Hero lifetime={aggregates.lifetime} />
        <StatsPanel aggregates={aggregates} />

        <footer className="font-mono text-[11px] opacity-40 mt-16 mb-12">
          fixture generated {aggregates.generatedAt.slice(0, 19).replace("T", " ")} UTC
        </footer>
      </div>
    </main>
  )
}
