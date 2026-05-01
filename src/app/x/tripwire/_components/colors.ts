// src/app/x/tripwire/_components/colors.ts
//
// Prime-moments palette helpers shared across the tripwire viz. Cycles
// `--color-moment-1..4` for indexed items, falls back to `--color-ink` for
// the long tail. Stable category → color mapping is built per-render from
// the `byCategory` aggregate so the same category always gets the same
// color across sections (the stacked bar, the path-list bars, etc.).

export function momentColor(index: number): string {
  return `var(--color-moment-${(index % 4) + 1})`
}

export type CategoryColors = Record<string, string>

export function buildCategoryColors(
  byCategory: ReadonlyArray<{ category: string }>,
): CategoryColors {
  const out: CategoryColors = {}
  byCategory.slice(0, 4).forEach((c, i) => {
    out[c.category] = momentColor(i)
  })
  return out
}

export function categoryColor(
  category: string | undefined,
  colors: CategoryColors,
): string {
  return (category && colors[category]) || "var(--color-ink)"
}
