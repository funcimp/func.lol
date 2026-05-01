// src/app/x/tripwire/preview/page.tsx
//
// Phase 0 prototype, narrowed: viz variants chosen during comparison
// review now read as a single coherent stats panel. Solid-fill bars in
// the prime-moments palette throughout; no dither (the user preferred
// the cleaner read).

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

// === Daily activity — solid bars, height proportional to count ===
function DailyActivity() {
  const cellW = 16
  const cellH = 56
  const gap = 2
  const width = data.byDay.length * (cellW + gap) - gap
  return (
    <div className="text-ink">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        daily activity
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
      <div className="font-mono text-[10px] opacity-55 mt-2">
        max {maxByDay} hits/day · {data.byDay[0]?.date.slice(0, 7)}–{data.byDay[data.byDay.length - 1]?.date.slice(0, 7)}
      </div>
    </div>
  )
}

// === Categories — stacked proportion bar with legend ===
function Categories() {
  const total = data.byCategory.reduce((n, c) => n + c.count, 0)
  // Pre-compute cumulative offsets so the JSX stays render-pure.
  const segments = data.byCategory.reduce<Array<{ category: string; x: number; w: number; count: number }>>(
    (acc, c) => {
      const prev = acc[acc.length - 1]
      const x = prev ? prev.x + prev.w : 0
      const w = (c.count / total) * 100
      acc.push({ category: c.category, x, w, count: c.count })
      return acc
    },
    [],
  )
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        what they were looking for
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

// === UA families — solid colored bars (4 families ↔ 4 moment colors) ===
function UaFamilies() {
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        ua families
      </h3>
      <ul className="space-y-2">
        {data.byUaFamily.map((u, i) => {
          const ratio = u.count / maxByUa
          const color = momentColor(i)
          return (
            <li key={u.ua} className="flex items-baseline gap-3">
              <span className="font-mono text-[12px] uppercase tracking-[0.14em] opacity-75 w-[120px] shrink-0">
                {u.ua}
              </span>
              <span className="tabular-nums font-mono text-[12px] opacity-55 w-[40px] shrink-0">
                {u.count}
              </span>
              <span className="flex-1 h-4">
                <svg width="100%" height="16" viewBox="0 0 100 16" preserveAspectRatio="none">
                  <rect x={0} y={0} width={ratio * 100} height={16} fill={color} />
                </svg>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// === Top paths — ranked list, solid colored bar per category ===
function TopPaths({ limit = 15 }: { limit?: number }) {
  const shown = data.topPaths.slice(0, limit)
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        most-probed paths
      </h3>
      <ul className="space-y-1">
        {shown.map((p) => {
          const ratio = p.count / maxByPath
          const color = categoryColor(p.category)
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
                style={{ color }}
              >
                {p.category ?? "-"}
              </span>
              <span className="w-[80px] shrink-0">
                <svg width="80" height="10" viewBox="0 0 80 10" preserveAspectRatio="none">
                  <rect x={0} y={0} width={ratio * 80} height={10} fill={color} />
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

// === ASNs — top N, top 4 colored, rest mono ===
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
              <span className="w-[80px] shrink-0">
                <svg width="80" height="10" viewBox="0 0 80 10" preserveAspectRatio="none">
                  <rect x={0} y={0} width={ratio * 80} height={10} fill={color} />
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
            phase 0 prototype · narrowed to chosen variants
          </p>
        </header>

        <Hero />

        <section className="mb-12"><DailyActivity /></section>
        <section className="mb-12"><Categories /></section>
        <section className="mb-12"><UaFamilies /></section>
        <section className="mb-12"><TopPaths limit={15} /></section>
        <section className="mb-12"><AsnBars limit={10} /></section>

        <footer className="font-mono text-[11px] opacity-40 mt-16 mb-12">
          fixture generated {data.generatedAt.slice(0, 19).replace("T", " ")} UTC
        </footer>
      </div>
    </main>
  )
}
