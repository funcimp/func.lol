// src/app/x/tripwire/_components/StatsPanel.tsx
//
// Tripwire stats viz. Solid-fill bars throughout in the prime-moments
// palette (no dither, since V2 dither is reserved per DESIGN.md for
// separate experiments; here color carries the meaning). Each component
// is data-agnostic and takes its slice of the aggregate as a prop, so
// the same components render the live blob (production /x/tripwire)
// and the fixture (preview /x/tripwire/preview).

import type { Aggregates } from "@/lib/tripwire/aggregate-shape"
import {
  buildCategoryColors,
  categoryColor,
  momentColor,
  type CategoryColors,
} from "./colors"

// === Hero: four big numbers in moment colors ===

export function Hero({ lifetime }: { lifetime: Aggregates["lifetime"] }) {
  const stats = [
    { label: "scanner attempts", value: lifetime.totalEvents },
    { label: "distinct IPs", value: lifetime.distinctIps },
    { label: "distinct paths", value: lifetime.distinctPaths },
    { label: "ASNs", value: lifetime.distinctAsns },
  ]
  return (
    <section className="mb-12">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <Stat key={s.label} label={s.label} value={s.value} color={momentColor(i)} />
        ))}
      </div>
      <p className="font-mono text-[11px] opacity-55 mt-4">
        across {lifetime.daysSinceFirst} days of operation ·{" "}
        {lifetime.earliestTs.slice(0, 10)} → {lifetime.latestTs.slice(0, 10)}
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

// === Daily activity: solid bars, count printed above so the visual
// encoding is never ambiguous ===

export function DailyActivity({ byDay }: { byDay: Aggregates["byDay"] }) {
  const cellW = 32
  const cellH = 96
  const gap = 6
  const labelTop = 14
  const labelBottom = 18
  const max = byDay.reduce((m, d) => Math.max(m, d.count), 1)
  const width = byDay.length * (cellW + gap) - gap
  const totalH = labelTop + cellH + labelBottom
  const total = byDay.reduce((n, d) => n + d.count, 0)
  return (
    <div className="text-ink">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        daily activity
      </h3>
      <div className="overflow-x-auto">
        <svg width={width} height={totalH} viewBox={`0 0 ${width} ${totalH}`}>
          {byDay.map((d, i) => {
            const ratio = d.count / max
            const h = Math.max(1, ratio * cellH)
            const cx = i * (cellW + gap) + cellW / 2
            const barTop = labelTop + (cellH - h)
            return (
              <g key={d.date}>
                <text
                  x={cx}
                  y={barTop - 4}
                  textAnchor="middle"
                  className="fill-ink font-mono tabular-nums"
                  style={{ fontSize: 10, opacity: 0.75 }}
                >
                  {d.count}
                </text>
                <rect
                  x={i * (cellW + gap)}
                  y={barTop}
                  width={cellW}
                  height={h}
                  fill="currentColor"
                />
                <text
                  x={cx}
                  y={labelTop + cellH + 13}
                  textAnchor="middle"
                  className="fill-ink font-mono"
                  style={{ fontSize: 10, opacity: 0.55 }}
                >
                  {d.date.slice(5)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="font-mono text-[10px] opacity-55 mt-2">
        {total} hits over {byDay.length} days
      </div>
    </div>
  )
}

// === Categories: stacked proportion bar with legend ===

export function Categories({
  byCategory,
  colors,
}: {
  byCategory: Aggregates["byCategory"]
  colors: CategoryColors
}) {
  const total = byCategory.reduce((n, c) => n + c.count, 0)
  const segments = byCategory.reduce<
    Array<{ category: string; x: number; w: number; count: number }>
  >((acc, c) => {
    const prev = acc[acc.length - 1]
    const x = prev ? prev.x + prev.w : 0
    const w = total > 0 ? (c.count / total) * 100 : 0
    acc.push({ category: c.category, x, w, count: c.count })
    return acc
  }, [])
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        what they were looking for
      </h3>
      <svg
        width="100%"
        height="32"
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        className="mb-3"
      >
        {segments.map((s) => (
          <rect
            key={s.category}
            x={s.x}
            y={0}
            width={s.w}
            height={32}
            fill={categoryColor(s.category, colors)}
          />
        ))}
      </svg>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
        {byCategory.map((c) => (
          <li key={c.category} className="flex items-center gap-2 font-mono text-[11px]">
            <span
              className="inline-block w-3 h-3 shrink-0"
              style={{ backgroundColor: categoryColor(c.category, colors) }}
            />
            <span className="uppercase tracking-[0.14em] opacity-75">{c.category}</span>
            <span className="opacity-55 tabular-nums">{c.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// === UA families: solid colored bars ===

export function UaFamilies({ byUaFamily }: { byUaFamily: Aggregates["byUaFamily"] }) {
  const max = byUaFamily.reduce((m, u) => Math.max(m, u.count), 1)
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        ua families
      </h3>
      <ul className="space-y-2">
        {byUaFamily.map((u, i) => {
          const ratio = u.count / max
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
                <svg
                  width="100%"
                  height="16"
                  viewBox="0 0 100 16"
                  preserveAspectRatio="none"
                >
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

// === Top paths: ranked list with category-colored bar ===

export function TopPaths({
  topPaths,
  colors,
  limit = 15,
}: {
  topPaths: Aggregates["topPaths"]
  colors: CategoryColors
  limit?: number
}) {
  const shown = topPaths.slice(0, limit)
  const max = topPaths.reduce((m, p) => Math.max(m, p.count), 1)
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        most-probed paths
      </h3>
      <ul className="space-y-1">
        {shown.map((p) => {
          const ratio = p.count / max
          const color = categoryColor(p.category, colors)
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
                <svg
                  width="80"
                  height="10"
                  viewBox="0 0 80 10"
                  preserveAspectRatio="none"
                >
                  <rect x={0} y={0} width={ratio * 80} height={10} fill={color} />
                </svg>
              </span>
            </li>
          )
        })}
      </ul>
      {topPaths.length > limit && (
        <p className="font-mono text-[11px] opacity-40 mt-3">
          + {topPaths.length - limit} more paths
        </p>
      )}
    </div>
  )
}

// === ASNs: top N, top 4 colored, rest mono ===

export function AsnBars({
  byAsn,
  limit = 10,
}: {
  byAsn: Aggregates["byAsn"]
  limit?: number
}) {
  const shown = byAsn.slice(0, limit)
  const max = byAsn.reduce((m, a) => Math.max(m, a.count), 1)
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 mb-3">
        where they came from / origin networks (top {limit})
      </h3>
      <ul className="space-y-2">
        {shown.map((a, i) => {
          const ratio = a.count / max
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
                <svg
                  width="80"
                  height="10"
                  viewBox="0 0 80 10"
                  preserveAspectRatio="none"
                >
                  <rect x={0} y={0} width={ratio * 80} height={10} fill={color} />
                </svg>
              </span>
            </li>
          )
        })}
      </ul>
      {byAsn.length > limit && (
        <p className="font-mono text-[11px] opacity-40 mt-3">
          + {byAsn.length - limit} more ASNs
        </p>
      )}
    </div>
  )
}

// === Wrapper: full stats panel in the canonical order ===

export function StatsPanel({ aggregates }: { aggregates: Aggregates }) {
  const colors = buildCategoryColors(aggregates.byCategory)
  return (
    <>
      <section className="mb-12"><DailyActivity byDay={aggregates.byDay} /></section>
      <section className="mb-12">
        <Categories byCategory={aggregates.byCategory} colors={colors} />
      </section>
      <section className="mb-12"><UaFamilies byUaFamily={aggregates.byUaFamily} /></section>
      <section className="mb-12">
        <TopPaths topPaths={aggregates.topPaths} colors={colors} limit={15} />
      </section>
      <section className="mb-12"><AsnBars byAsn={aggregates.byAsn} limit={10} /></section>
    </>
  )
}
