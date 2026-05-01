// src/app/x/tripwire/preview/page.tsx
//
// Phase 0 prototype: render the tripwire stats fixture in candidate viz
// shapes for design review. Not deployed in v1 — exists to compare options
// before committing to the final stats panel on /x/tripwire.

import type { Metadata } from "next"
import Link from "next/link"

import ThemeToggle from "@/components/ThemeToggle"
import aggregates from "../_fixtures/aggregates.sample.json"

export const metadata: Metadata = {
  title: "Tripwire stats — preview",
  robots: { index: false, follow: false },
}

interface Aggregates {
  generatedAt: string
  lifetime: {
    totalEvents: number
    earliestTs: string
    latestTs: string
    daysSinceFirst: number
    distinctIps: number
    distinctPaths: number
    distinctAsns: number
  }
  byCategory: Array<{ category: string; count: number }>
  byUaFamily: Array<{ ua: string; count: number }>
  byDay: Array<{ date: string; count: number }>
  topPaths: Array<{ path: string; count: number; category?: string }>
  byAsn: Array<{ asn: string; name: string; count: number }>
}

const data = aggregates as Aggregates
const maxByCategory = Math.max(...data.byCategory.map((c) => c.count))
const maxByUa = Math.max(...data.byUaFamily.map((c) => c.count))
const maxByDay = Math.max(...data.byDay.map((c) => c.count))
const maxByPath = Math.max(...data.topPaths.map((c) => c.count))
const maxByAsn = Math.max(...data.byAsn.map((c) => c.count))

// Bayer 4x4 dither pattern as an SVG pattern. Levels 0-5 used as fill density.
function DitherDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        {[0, 1, 2, 3, 4, 5].map((level) => (
          <pattern
            key={level}
            id={`dither-${level}`}
            x="0"
            y="0"
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
          >
            {/* Bayer 4x4 thresholds — fill cells whose threshold ≤ level */}
            {[
              [0, 8, 2, 10],
              [12, 4, 14, 6],
              [3, 11, 1, 9],
              [15, 7, 13, 5],
            ].flatMap((row, y) =>
              row.map((threshold, x) => {
                const intensity = level / 5
                const filled = threshold / 16 < intensity
                return filled ? <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill="currentColor" /> : null
              }),
            )}
          </pattern>
        ))}
      </defs>
    </svg>
  )
}

// Map a 0..1 ratio to a dither level (0..5).
function ditherLevel(ratio: number): number {
  return Math.max(1, Math.round(ratio * 5))
}

// Section: hero counts
function Hero() {
  return (
    <section className="mb-12">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        <Stat label="scanner attempts" value={data.lifetime.totalEvents} />
        <Stat label="distinct IPs" value={data.lifetime.distinctIps} />
        <Stat label="distinct paths" value={data.lifetime.distinctPaths} />
        <Stat label="ASNs" value={data.lifetime.distinctAsns} />
      </div>
      <p className="font-mono text-[11px] opacity-55 mt-4">
        across {data.lifetime.daysSinceFirst} days of operation · {data.lifetime.earliestTs.slice(0, 10)} → {data.lifetime.latestTs.slice(0, 10)}
      </p>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[40px] sm:text-[48px] font-bold leading-none tracking-[-0.04em] tabular-nums">
        {value}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-55 mt-2">
        {label}
      </div>
    </div>
  )
}

// Section: daily activity — day strip variant
// Single row of cells, ink density proportional to count for that day.
function DayStrip() {
  const cellW = 16
  const cellH = 56
  const gap = 2
  const width = data.byDay.length * (cellW + gap) - gap
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        daily activity / day strip
      </h3>
      <div className="overflow-x-auto">
        <svg width={width} height={cellH + 24} viewBox={`0 0 ${width} ${cellH + 24}`} className="text-ink">
          {data.byDay.map((d, i) => {
            const ratio = d.count / maxByDay
            const level = ditherLevel(ratio)
            return (
              <g key={d.date}>
                <rect
                  x={i * (cellW + gap)}
                  y={0}
                  width={cellW}
                  height={cellH}
                  fill={`url(#dither-${level})`}
                  className="text-ink"
                />
                <text
                  x={i * (cellW + gap) + cellW / 2}
                  y={cellH + 14}
                  textAnchor="middle"
                  className="fill-ink font-mono"
                  style={{ fontSize: 9, opacity: 0.55 }}
                >
                  {d.date.slice(8, 10)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="font-mono text-[10px] opacity-55 mt-2">
        {data.byDay[0]?.date.slice(0, 7)} – {data.byDay[data.byDay.length - 1]?.date.slice(0, 7)}
        {" "}· max {maxByDay} hits/day
      </div>
    </div>
  )
}

// Section: categories — horizontal dithered bars
function CategoryBars() {
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        what they were looking for / categories
      </h3>
      <ul className="space-y-2">
        {data.byCategory.map((c) => {
          const ratio = c.count / maxByCategory
          const level = ditherLevel(ratio)
          return (
            <li key={c.category} className="flex items-baseline gap-3">
              <span className="font-mono text-[12px] uppercase tracking-[0.14em] opacity-75 w-[80px] shrink-0">
                {c.category}
              </span>
              <span className="tabular-nums font-mono text-[12px] opacity-55 w-[40px] shrink-0">
                {c.count}
              </span>
              <span className="flex-1 h-4 text-ink relative">
                <svg width="100%" height="16" viewBox="0 0 100 16" preserveAspectRatio="none" className="text-ink">
                  <rect x={0} y={0} width={ratio * 100} height={16} fill={`url(#dither-${level})`} />
                </svg>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Section: top paths — ranked text with count bar
function TopPaths({ limit = 15 }: { limit?: number }) {
  const shown = data.topPaths.slice(0, limit)
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        most-probed paths / top {limit}
      </h3>
      <ul className="space-y-1">
        {shown.map((p) => {
          const ratio = p.count / maxByPath
          const level = ditherLevel(ratio)
          return (
            <li key={p.path} className="flex items-baseline gap-3">
              <span className="tabular-nums font-mono text-[12px] opacity-55 w-[30px] shrink-0 text-right">
                {p.count}
              </span>
              <span className="font-mono text-[13px] truncate min-w-0 flex-1">
                {p.path}
              </span>
              <span className="font-mono text-[10px] opacity-40 uppercase tracking-[0.14em] w-[60px] shrink-0 text-right">
                {p.category ?? "-"}
              </span>
              <span className="w-[80px] shrink-0 text-ink">
                <svg width="80" height="10" viewBox="0 0 80 10" preserveAspectRatio="none" className="text-ink">
                  <rect x={0} y={0} width={ratio * 80} height={10} fill={`url(#dither-${level})`} />
                </svg>
              </span>
            </li>
          )
        })}
      </ul>
      {data.topPaths.length > limit && (
        <p className="font-mono text-[11px] opacity-40 mt-3">
          + {data.topPaths.length - limit} more paths
        </p>
      )}
    </div>
  )
}

// Section: ASNs — origins
function AsnBars() {
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        where they came from / origin networks
      </h3>
      <ul className="space-y-2">
        {data.byAsn.map((a) => {
          const ratio = a.count / maxByAsn
          const level = ditherLevel(ratio)
          return (
            <li key={a.asn} className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] opacity-55 w-[80px] shrink-0">
                {a.asn}
              </span>
              <span className="font-mono text-[12px] truncate min-w-0 flex-1">
                {a.name}
              </span>
              <span className="tabular-nums font-mono text-[12px] opacity-55 w-[40px] shrink-0 text-right">
                {a.count}
              </span>
              <span className="w-[80px] shrink-0 text-ink">
                <svg width="80" height="10" viewBox="0 0 80 10" preserveAspectRatio="none" className="text-ink">
                  <rect x={0} y={0} width={ratio * 80} height={10} fill={`url(#dither-${level})`} />
                </svg>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Section: UA families — for context, scanner-honesty signal
function UaFamilies() {
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        ua families
      </h3>
      <ul className="space-y-2">
        {data.byUaFamily.map((u) => {
          const ratio = u.count / maxByUa
          const level = ditherLevel(ratio)
          return (
            <li key={u.ua} className="flex items-baseline gap-3">
              <span className="font-mono text-[12px] uppercase tracking-[0.14em] opacity-75 w-[120px] shrink-0">
                {u.ua}
              </span>
              <span className="tabular-nums font-mono text-[12px] opacity-55 w-[40px] shrink-0">
                {u.count}
              </span>
              <span className="flex-1 h-4 text-ink">
                <svg width="100%" height="16" viewBox="0 0 100 16" preserveAspectRatio="none" className="text-ink">
                  <rect x={0} y={0} width={ratio * 100} height={16} fill={`url(#dither-${level})`} />
                </svg>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function TripwirePreviewPage() {
  return (
    <main className="min-h-screen px-6 py-12 sm:px-16 sm:py-16">
      <DitherDefs />
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
            phase 0 prototype · candidate visualizations against real data
          </p>
        </header>

        <Hero />

        <section className="mb-12">
          <DayStrip />
        </section>

        <section className="mb-12">
          <CategoryBars />
        </section>

        <section className="mb-12">
          <UaFamilies />
        </section>

        <section className="mb-12">
          <TopPaths limit={15} />
        </section>

        <section className="mb-12">
          <AsnBars />
        </section>

        <footer className="font-mono text-[11px] opacity-40 mt-16 mb-12">
          fixture generated {data.generatedAt.slice(0, 19).replace("T", " ")} UTC
        </footer>
      </div>
    </main>
  )
}
