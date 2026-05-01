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

// Reuse the prime-moments palette (the only color on the site). Cycle
// through 4 colors for indexed items; fall back to ink for the long tail.
function momentColor(index: number): string {
  return `var(--color-moment-${(index % 4) + 1})`
}

// Stable category → color map (top 4 categories get moment colors;
// rest fall back to ink).
const CATEGORY_COLORS: Record<string, string> = {}
data.byCategory.slice(0, 4).forEach((c, i) => {
  CATEGORY_COLORS[c.category] = momentColor(i)
})
function categoryColor(category: string | undefined): string {
  return (category && CATEGORY_COLORS[category]) || "var(--color-ink)"
}

// Bayer 4x4 dither pattern as an SVG pattern. Levels 0-5 used as fill
// density. `currentColor` lets us recolor the fill from the CSS context.
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

function ditherLevel(ratio: number): number {
  return Math.max(1, Math.round(ratio * 5))
}

// === Section: hero counts ===
function Hero() {
  const stats = [
    { label: "scanner attempts", value: data.lifetime.totalEvents },
    { label: "distinct IPs", value: data.lifetime.distinctIps },
    { label: "distinct paths", value: data.lifetime.distinctPaths },
    { label: "ASNs", value: data.lifetime.distinctAsns },
  ]
  return (
    <section className="mb-12">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <Stat key={s.label} label={s.label} value={s.value} color={momentColor(i)} />
        ))}
      </div>
      <p className="font-mono text-[11px] opacity-55 mt-4">
        across {data.lifetime.daysSinceFirst} days of operation · {data.lifetime.earliestTs.slice(0, 10)} → {data.lifetime.latestTs.slice(0, 10)}
      </p>
    </section>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div
        className="text-[40px] sm:text-[48px] font-bold leading-none tracking-[-0.04em] tabular-nums"
        style={{ color }}
      >
        {value}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-55 mt-2">
        {label}
      </div>
    </div>
  )
}

// === Section: daily activity / variants ===

// Variant A: day strip — single row of dithered cells.
function DayStrip() {
  const cellW = 16
  const cellH = 56
  const gap = 2
  const width = data.byDay.length * (cellW + gap) - gap
  return (
    <div className="text-ink">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        daily activity / variant A — day strip (mono dither)
      </h3>
      <div className="overflow-x-auto">
        <svg width={width} height={cellH + 24} viewBox={`0 0 ${width} ${cellH + 24}`}>
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
        max {maxByDay} hits/day · {data.byDay[0]?.date.slice(0, 7)}–{data.byDay[data.byDay.length - 1]?.date.slice(0, 7)}
      </div>
    </div>
  )
}

// Variant B: solid bars per day, height = count, no dither.
function DayBars() {
  const cellW = 16
  const cellH = 56
  const gap = 2
  const width = data.byDay.length * (cellW + gap) - gap
  return (
    <div className="text-ink">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        daily activity / variant B — solid bars
      </h3>
      <div className="overflow-x-auto">
        <svg width={width} height={cellH + 24} viewBox={`0 0 ${width} ${cellH + 24}`}>
          {data.byDay.map((d, i) => {
            const ratio = d.count / maxByDay
            const h = Math.max(1, ratio * cellH)
            return (
              <g key={d.date}>
                <rect
                  x={i * (cellW + gap)}
                  y={cellH - h}
                  width={cellW}
                  height={h}
                  fill="currentColor"
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
    </div>
  )
}

// Variant C: sparkline — continuous line through daily counts.
function DaySparkline() {
  const w = 720
  const h = 80
  const pad = 2
  const xs = (i: number) => pad + (i / (data.byDay.length - 1)) * (w - pad * 2)
  const ys = (count: number) => h - pad - (count / maxByDay) * (h - pad * 2)
  const points = data.byDay.map((d, i) => `${xs(i).toFixed(1)},${ys(d.count).toFixed(1)}`).join(" ")
  return (
    <div className="text-ink">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        daily activity / variant C — sparkline
      </h3>
      <svg width={w} height={h + 22} viewBox={`0 0 ${w} ${h + 22}`} preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} />
        {data.byDay.map((d, i) => (
          <circle key={d.date} cx={xs(i)} cy={ys(d.count)} r={2} fill="currentColor" />
        ))}
        <text x={xs(0)} y={h + 14} className="fill-ink font-mono" style={{ fontSize: 9, opacity: 0.55 }}>
          {data.byDay[0]?.date.slice(5)}
        </text>
        <text
          x={xs(data.byDay.length - 1)}
          y={h + 14}
          textAnchor="end"
          className="fill-ink font-mono"
          style={{ fontSize: 9, opacity: 0.55 }}
        >
          {data.byDay[data.byDay.length - 1]?.date.slice(5)}
        </text>
      </svg>
    </div>
  )
}

// === Section: categories / variants ===

// Variant A: horizontal dithered bars, one row per category, in moment colors.
function CategoryBars() {
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        categories / variant A — colored dithered bars
      </h3>
      <ul className="space-y-2">
        {data.byCategory.map((c) => {
          const ratio = c.count / maxByCategory
          const level = ditherLevel(ratio)
          const color = categoryColor(c.category)
          return (
            <li key={c.category} className="flex items-baseline gap-3">
              <span className="font-mono text-[12px] uppercase tracking-[0.14em] opacity-75 w-[80px] shrink-0">
                {c.category}
              </span>
              <span className="tabular-nums font-mono text-[12px] opacity-55 w-[40px] shrink-0">
                {c.count}
              </span>
              <span className="flex-1 h-4" style={{ color }}>
                <svg width="100%" height="16" viewBox="0 0 100 16" preserveAspectRatio="none">
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

// Variant B: stacked single bar showing proportions across all categories.
function CategoryStacked() {
  const total = data.byCategory.reduce((n, c) => n + c.count, 0)
  // Pre-compute cumulative offsets so the JSX is render-pure.
  const segments = data.byCategory.reduce<Array<{ category: string; x: number; w: number }>>(
    (acc, c) => {
      const prev = acc[acc.length - 1]
      const x = prev ? prev.x + prev.w : 0
      const w = (c.count / total) * 100
      acc.push({ category: c.category, x, w })
      return acc
    },
    [],
  )
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        categories / variant B — stacked proportion bar
      </h3>
      <svg width="100%" height="32" viewBox="0 0 100 32" preserveAspectRatio="none" className="mb-3">
        {segments.map((s) => (
          <rect
            key={s.category}
            x={s.x}
            y={0}
            width={s.w}
            height={32}
            fill={categoryColor(s.category)}
          />
        ))}
      </svg>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
        {data.byCategory.map((c) => (
          <li key={c.category} className="flex items-center gap-2 font-mono text-[11px]">
            <span
              className="inline-block w-3 h-3 shrink-0"
              style={{ backgroundColor: categoryColor(c.category) }}
            />
            <span className="uppercase tracking-[0.14em] opacity-75">{c.category}</span>
            <span className="opacity-55 tabular-nums">{c.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// === Section: UA families ===
function UaFamilies() {
  // Cycle through moment colors per UA family (4 UAs ↔ 4 moment colors).
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        ua families
      </h3>
      <ul className="space-y-2">
        {data.byUaFamily.map((u, i) => {
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
              <span className="flex-1 h-4" style={{ color: momentColor(i) }}>
                <svg width="100%" height="16" viewBox="0 0 100 16" preserveAspectRatio="none">
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

// === Section: top paths / variants ===

// Variant A: ranked list, each row colored by its category.
function TopPathsList({ limit = 15 }: { limit?: number }) {
  const shown = data.topPaths.slice(0, limit)
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        most-probed paths / variant A — ranked list with category color
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
              <span
                className="font-mono text-[10px] uppercase tracking-[0.14em] w-[60px] shrink-0 text-right"
                style={{ color: categoryColor(p.category) }}
              >
                {p.category ?? "-"}
              </span>
              <span className="w-[80px] shrink-0" style={{ color: categoryColor(p.category) }}>
                <svg width="80" height="10" viewBox="0 0 80 10" preserveAspectRatio="none">
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

// Variant B: wall of words — font size proportional to count.
function TopPathsWall({ limit = 30 }: { limit?: number }) {
  const shown = data.topPaths.slice(0, limit)
  // Map count to font-size 11..28 for visual weight
  const sizeFor = (count: number) => {
    const ratio = count / maxByPath
    return 11 + ratio * 17
  }
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        most-probed paths / variant B — wall of words
      </h3>
      <p className="font-mono leading-[1.7]">
        {shown.map((p, i) => (
          <span
            key={p.path}
            className="mr-3 align-middle"
            style={{
              fontSize: `${sizeFor(p.count)}px`,
              color: categoryColor(p.category),
              opacity: 0.5 + (p.count / maxByPath) * 0.5,
            }}
            title={`${p.count}× ${p.category ?? ""}`}
          >
            {p.path}
            {i < shown.length - 1 ? " ·" : ""}
          </span>
        ))}
      </p>
    </div>
  )
}

// === Section: ASNs ===
function AsnBars({ limit = 10 }: { limit?: number }) {
  const shown = data.byAsn.slice(0, limit)
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        where they came from / origin networks (top {limit})
      </h3>
      <ul className="space-y-2">
        {shown.map((a, i) => {
          const ratio = a.count / maxByAsn
          const level = ditherLevel(ratio)
          // Top 4 ASNs get moment colors; rest fall back to ink
          const color = i < 4 ? momentColor(i) : "var(--color-ink)"
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
              <span className="w-[80px] shrink-0" style={{ color }}>
                <svg width="80" height="10" viewBox="0 0 80 10" preserveAspectRatio="none">
                  <rect x={0} y={0} width={ratio * 80} height={10} fill={`url(#dither-${level})`} />
                </svg>
              </span>
            </li>
          )
        })}
      </ul>
      {data.byAsn.length > limit && (
        <p className="font-mono text-[11px] opacity-40 mt-3">
          + {data.byAsn.length - limit} more ASNs
        </p>
      )}
    </div>
  )
}

// === Page ===

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mt-16 mb-8">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-40">
        {label}
      </span>
      <span className="flex-1 border-t border-ink/15" />
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

        <Divider label="daily activity" />
        <section className="mb-8"><DayStrip /></section>
        <section className="mb-8"><DayBars /></section>
        <section className="mb-8"><DaySparkline /></section>

        <Divider label="categories" />
        <section className="mb-8"><CategoryBars /></section>
        <section className="mb-8"><CategoryStacked /></section>

        <Divider label="ua families" />
        <section className="mb-8"><UaFamilies /></section>

        <Divider label="top paths" />
        <section className="mb-8"><TopPathsList limit={15} /></section>
        <section className="mb-8"><TopPathsWall limit={30} /></section>

        <Divider label="origin networks" />
        <section className="mb-8"><AsnBars limit={10} /></section>

        <footer className="font-mono text-[11px] opacity-40 mt-16 mb-12">
          fixture generated {data.generatedAt.slice(0, 19).replace("T", " ")} UTC
        </footer>
      </div>
    </main>
  )
}
