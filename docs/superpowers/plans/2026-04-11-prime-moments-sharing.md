# Prime Moments Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a privacy-preserving share feature to the Prime Moments lab. Users can copy a URL that encodes only the constellation offsets; viewers of a shared URL see a dedicated read-only share view that computes and displays lifetime instances without any identifying data.

**Architecture:** Query-param-driven branching on the existing lab route. The server component at `/labs/prime-moments` reads `?share=<offsets>` via `searchParams`, validates, and renders either the normal finder or a new `<SharedConstellation>` server component. A programmatic `<ConstellationEmblem>` generates a regular-polygon SVG from the offsets array. A small `lib/share.ts` handles pure encoding/parsing. No server state, no database, no new routes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, bun (package manager + test runner).

**Spec:** [docs/superpowers/specs/2026-04-11-prime-moments-sharing-design.md](../specs/2026-04-11-prime-moments-sharing-design.md)

---

## File map

### Files created

- `src/app/labs/prime-moments/lib/share.ts` — `encodeShareParam` and `parseShareParam` pure helpers.
- `src/app/labs/prime-moments/lib/share.test.ts` — table-driven tests for both.
- `src/app/labs/prime-moments/ConstellationEmblem.tsx` — programmatic polygon SVG, `{ offsets: number[] }` prop, uses `currentColor`.
- `src/app/labs/prime-moments/SharedConstellation.tsx` — server component that renders the share view layout given parsed offsets.

### Files modified

- `src/app/labs/prime-moments/lib/primeMoments.ts` — add `findLifetimeInstances(offsets, maxLifespan)` exported helper.
- `src/app/labs/prime-moments/lib/primeMoments.test.ts` — add tests for `findLifetimeInstances`.
- `src/app/labs/prime-moments/page.tsx` — convert to `async` server component, accept `searchParams` prop, parse `?share=`, branch between normal finder and `<SharedConstellation>`.
- `src/app/labs/prime-moments/PrimeMomentsFinder.tsx` — add an actions row below results with a `share` button that copies the share URL to the clipboard and flips its label to `copied ✓` for 2 seconds.

### Files unchanged

- Everything else. `DESIGN.md`, `AGENTS.md`, `IDEAS.md`, the root layout, the theme toggle, the existing lib files untouched by this feature, the research folder.

---

## Phase outline

- **Phase A** — Pure lib helpers with TDD. Tasks 1–2.
- **Phase B** — New components (no unit tests; component layer is tested by eye and by the existing build pipeline). Tasks 3–4.
- **Phase C** — Integrate into existing pages. Tasks 5–6.
- **Phase D** — Final verification (lint + build + test + manual). Task 7.

Tasks are inserted below this line, one at a time, via subsequent edits.

---

## Phase A — Pure lib helpers (TDD)

---

### Task 1: `findLifetimeInstances` helper in `primeMoments.ts`

**Files:**

- Modify: `src/app/labs/prime-moments/lib/primeMoments.ts`
- Modify: `src/app/labs/prime-moments/lib/primeMoments.test.ts`

**Context:** The share view needs to compute, from offsets alone, the full list of all-prime age tuples that fit within a human lifespan. This is a pure deterministic function of the offset array and the lifespan cap. It reuses `isPrime` from `./primes` (already imported by `primeMoments.ts`). No dependency on `findPrimeMoments`, no dependency on any group data.

- [ ] **Step 1: Write the failing test**

Open `src/app/labs/prime-moments/lib/primeMoments.test.ts`. At the end of the file (after the final `describe` block), append:

```ts
import { findLifetimeInstances } from "./primeMoments";

describe("findLifetimeInstances", () => {
  test("returns all four Toups Primes triples for [0, 30, 32]", () => {
    expect(findLifetimeInstances([0, 30, 32])).toEqual([
      [11, 41, 43],
      [29, 59, 61],
      [41, 71, 73],
      [71, 101, 103],
    ]);
  });

  test("returns every odd prime ≤ 122 for [0]", () => {
    const result = findLifetimeInstances([0]);
    expect(result.length).toBe(29); // 29 odd primes ≤ 122
    expect(result[0]).toEqual([3]);
    expect(result[result.length - 1]).toEqual([113]);
  });

  test("returns multiple instances for [0, 6, 12]", () => {
    const result = findLifetimeInstances([0, 6, 12]);
    expect(result.length).toBeGreaterThan(1);
    // Spot check: (5, 11, 17) should be one of them
    expect(result).toContainEqual([5, 11, 17]);
  });

  test("respects maxLifespan parameter", () => {
    const result = findLifetimeInstances([0, 30, 32], 50);
    // Only (11, 41, 43) fits — every other Toups Primes instance has
    // at least one age above 50.
    expect(result).toEqual([[11, 41, 43]]);
  });

  test("returns empty for empty offsets", () => {
    expect(findLifetimeInstances([])).toEqual([]);
  });
});
```

Note: the `import { findLifetimeInstances }` line goes at the *top* of the file with the other imports. Duplicating here in the append block is just for clarity — actually add the symbol to the existing `import { findPrimeMoments }` line so it reads:

```ts
import { findLifetimeInstances, findPrimeMoments } from "./primeMoments";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/app/labs/prime-moments/lib/primeMoments.test.ts`

Expected: fails with `error: Export named 'findLifetimeInstances' not found in module './primeMoments'` or similar, because the helper doesn't exist yet.

- [ ] **Step 3: Implement `findLifetimeInstances`**

Open `src/app/labs/prime-moments/lib/primeMoments.ts`. At the very end of the file (after the closing brace of `findPrimeMoments`), append:

```ts

/**
 * For a given constellation pattern (sorted offsets starting at 0),
 * return every all-prime age tuple that fits within maxLifespan. Used
 * by the share view to display "lifetime instances" from offsets alone,
 * with no group data.
 *
 * Walks odd base primes p = 3, 5, 7, ... up to maxLifespan - max(offsets).
 * For each p, checks whether every (p + offset) is prime. If so, records
 * the tuple. Returns an array of age tuples, earliest-base-first.
 *
 * Returns [] for empty offsets.
 */
export function findLifetimeInstances(
  offsets: number[],
  maxLifespan: number = DEFAULT_MAX_LIFESPAN,
): number[][] {
  if (offsets.length === 0) return [];
  const maxOffset = offsets[offsets.length - 1];
  const instances: number[][] = [];
  for (let p = 3; p + maxOffset <= maxLifespan; p += 2) {
    if (offsets.every((o) => isPrime(p + o))) {
      instances.push(offsets.map((o) => p + o));
    }
  }
  return instances;
}
```

Note: `DEFAULT_MAX_LIFESPAN` is already a `const` at the top of this file (defined alongside the other constants). `isPrime` is already imported from `./primes`. No new imports needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/app/labs/prime-moments/lib/primeMoments.test.ts`

Expected: all tests in `findLifetimeInstances` pass, plus all pre-existing tests still pass. Target: test count increased by 5.

- [ ] **Step 5: Run the full test suite as a sanity check**

Run: `bun test`

Expected: `72 pass, 0 fail` (67 pre-existing + 5 new).

- [ ] **Step 6: Commit**

```bash
git add src/app/labs/prime-moments/lib/primeMoments.ts src/app/labs/prime-moments/lib/primeMoments.test.ts
git commit -m "feat(prime-moments): add findLifetimeInstances helper"
```

---

### Task 2: `share.ts` encoder and parser

**Files:**

- Create: `src/app/labs/prime-moments/lib/share.ts`
- Create: `src/app/labs/prime-moments/lib/share.test.ts`

**Context:** Pure syntactic helpers for the share URL. `encodeShareParam` turns `number[]` into `"0,30,32"`. `parseShareParam` reverses it, with strict validation: reject non-strings, empty strings, non-numeric parts, negatives, non-integers, values over `MAX_LIFESPAN`, patterns that don't start with `0`, and non-strictly-ascending sequences. Admissibility is **not** checked here — that's the caller's responsibility, because `parseShareParam` must stay import-light (no dependency on `isAdmissibleConstellation`).

Multi-constellation URLs (`"0,30,32;0,6,12"`) are handled by splitting on `;` and taking only the first segment. MVP never emits these but the parser is defensive for forward compatibility.

- [ ] **Step 1: Write the failing test**

Create `src/app/labs/prime-moments/lib/share.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { encodeShareParam, parseShareParam } from "./share";

describe("encodeShareParam", () => {
  test("comma-joins offsets", () => {
    expect(encodeShareParam([0, 30, 32])).toBe("0,30,32");
  });
  test("handles single-element", () => {
    expect(encodeShareParam([0])).toBe("0");
  });
  test("handles larger constellations", () => {
    expect(encodeShareParam([0, 6, 12, 18, 24])).toBe("0,6,12,18,24");
  });
});

describe("parseShareParam — valid inputs", () => {
  const cases: Array<[string, number[]]> = [
    ["0,30,32", [0, 30, 32]],
    ["0", [0]],
    ["0,6,12,18,24", [0, 6, 12, 18, 24]],
    ["0, 30, 32", [0, 30, 32]], // whitespace tolerated
    ["0,30,32;0,6", [0, 30, 32]], // multi-constellation — first only
  ];
  for (const [input, expected] of cases) {
    test(`accepts ${JSON.stringify(input)}`, () => {
      expect(parseShareParam(input)).toEqual(expected);
    });
  }
});

describe("parseShareParam — invalid inputs", () => {
  const cases: Array<[string | string[] | undefined, string]> = [
    [undefined, "undefined"],
    [["a", "b"], "array value"],
    ["", "empty string"],
    ["   ", "whitespace only"],
    ["not,numbers", "non-numeric parts"],
    ["1,30,32", "doesn't start with 0"],
    ["0,30,30", "not strictly ascending (duplicate)"],
    ["0,30,20", "descending"],
    ["0,-5", "negative value"],
    ["0,200", "over maxLifespan"],
    ["0,3.5", "non-integer"],
  ];
  for (const [input, label] of cases) {
    test(`rejects ${label}`, () => {
      expect(parseShareParam(input)).toBeNull();
    });
  }
});

describe("parseShareParam round-trip", () => {
  test("encode → parse recovers the original offsets", () => {
    const offsets = [0, 30, 32];
    expect(parseShareParam(encodeShareParam(offsets))).toEqual(offsets);
  });
  test("single-element round-trip", () => {
    expect(parseShareParam(encodeShareParam([0]))).toEqual([0]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/app/labs/prime-moments/lib/share.test.ts`

Expected: fails with `Cannot find module './share'` or similar, because `share.ts` doesn't exist yet.

- [ ] **Step 3: Create `share.ts`**

Create `src/app/labs/prime-moments/lib/share.ts`:

```ts
// Share encoding for Prime Moments constellations.
//
// Pure syntactic helpers — no dependency on primality or admissibility.
// The caller is responsible for the admissibility check after parsing.

const MAX_LIFESPAN = 122;

/**
 * Serialize a constellation's offsets as a share-URL-friendly string.
 * Output is comma-separated, no brackets, no spaces. Example: "0,30,32".
 */
export function encodeShareParam(offsets: number[]): string {
  return offsets.join(",");
}

/**
 * Parse a raw share-URL query value into a validated offsets array.
 * Returns null for any invalid input — the caller should treat null as
 * "fall through to the normal page" and render no error.
 *
 * Validation rules:
 * - Must be a non-empty string (not undefined, not string[]).
 * - Parts after comma-splitting must all be integers.
 * - Integers must be in [0, MAX_LIFESPAN].
 * - The array must start with 0 (canonical form, offsets are relative
 *   to the youngest member).
 * - The array must be strictly ascending.
 *
 * Multi-constellation extension: anything after the first ";" is
 * ignored. MVP never emits these but the parser is forward-compatible.
 */
export function parseShareParam(
  raw: string | string[] | undefined,
): number[] | null {
  if (typeof raw !== "string") return null;
  if (raw.trim() === "") return null;

  const firstConstellation = raw.split(";")[0];
  const parts = firstConstellation.split(",").map((s) => s.trim());
  const offsets = parts.map((s) => Number(s));

  if (
    offsets.some(
      (n) => !Number.isInteger(n) || n < 0 || n > MAX_LIFESPAN,
    )
  ) {
    return null;
  }
  if (offsets[0] !== 0) return null;
  for (let i = 1; i < offsets.length; i++) {
    if (offsets[i] <= offsets[i - 1]) return null;
  }
  return offsets;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/app/labs/prime-moments/lib/share.test.ts`

Expected: all tests pass. Count: 3 encode tests + 5 valid parse + 11 invalid parse + 2 round-trip = 21 new tests.

- [ ] **Step 5: Run the full test suite**

Run: `bun test`

Expected: `93 pass, 0 fail` (72 after Task 1 + 21 new).

- [ ] **Step 6: Run lint + build as a sanity check**

Run: `bun run lint && bun run build`

Expected: clean. The new file compiles, no other code references it yet.

- [ ] **Step 7: Commit**

```bash
git add src/app/labs/prime-moments/lib/share.ts src/app/labs/prime-moments/lib/share.test.ts
git commit -m "feat(prime-moments): add share URL encoder and parser"
```

---

## Phase B — New components (no unit tests; verified by build + eye)

---

### Task 3: `ConstellationEmblem` programmatic polygon

**Files:**

- Create: `src/app/labs/prime-moments/ConstellationEmblem.tsx`

**Context:** A server-safe React component that takes an array of offsets and renders a regular-polygon SVG with that many vertices. `n = 1` renders a single filled dot; `n = 2` renders a line segment with two dots; `n ≥ 3` renders vertices + all pairwise edges + a dither-filled polygon interior. Uses `currentColor` throughout so it inherits the theme. Same stippled `<pattern>` visual as the existing lab-page emblem, but generalized.

Why not unit-tested: per `DESIGN.md`, the React layer is verified by eye, not unit tests. The only way this component breaks is typography/visual regression, which a unit test can't catch.

- [ ] **Step 1: Create `ConstellationEmblem.tsx`**

Create `src/app/labs/prime-moments/ConstellationEmblem.tsx`:

```tsx
// Programmatic regular-polygon emblem for a constellation. Takes an
// array of offsets and renders N points evenly spaced on a circle,
// connected by lines, with the interior filled by the same stippled
// dither pattern used elsewhere in the lab.
//
// n = 1: single filled dot
// n = 2: line segment with two dots
// n ≥ 3: polygon with all pairwise edges + dither-filled interior
//
// Uses currentColor so it inherits the theme.

import type { SVGProps } from "react";

const VB = 96; // viewBox side length
const CX = VB / 2;
const CY = VB / 2;
const RADIUS = 32; // distance from center to each vertex
const DOT_RADIUS = 5;
const STROKE_WIDTH = 0.7;
const PATTERN_ID = "constellation-emblem-dot";

interface ConstellationEmblemProps
  extends Omit<SVGProps<SVGSVGElement>, "role" | "aria-label"> {
  offsets: number[];
}

export default function ConstellationEmblem({
  offsets,
  ...props
}: ConstellationEmblemProps) {
  const n = offsets.length;

  // Place n vertices evenly around a circle, first at the top (12 o'clock).
  const points = Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return {
      x: CX + RADIUS * Math.cos(angle),
      y: CY + RADIUS * Math.sin(angle),
    };
  });

  // Build the polygon fill path only for n ≥ 3.
  const polygonPath =
    n >= 3
      ? `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")} Z`
      : "";

  // Pairwise edges. For n = 2, one edge; for n ≥ 3, all pairs.
  const edges: Array<[number, number]> = [];
  if (n === 2) {
    edges.push([0, 1]);
  } else if (n >= 3) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        edges.push([i, j]);
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`constellation with ${n} point${n === 1 ? "" : "s"}`}
      {...props}
    >
      <defs>
        <pattern
          id={PATTERN_ID}
          width="3"
          height="3"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1.5" cy="1.5" r="0.6" fill="currentColor" />
        </pattern>
      </defs>
      {n >= 3 && (
        <path
          d={polygonPath}
          fill={`url(#${PATTERN_ID})`}
          opacity="0.7"
        />
      )}
      {edges.map(([i, j]) => (
        <line
          key={`${i}-${j}`}
          x1={points[i].x}
          y1={points[i].y}
          x2={points[j].x}
          y2={points[j].y}
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
        />
      ))}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={DOT_RADIUS}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
```

- [ ] **Step 2: Run lint to verify the component compiles**

Run: `bun run lint`

Expected: clean. No new ESLint warnings.

- [ ] **Step 3: Run the build to verify TypeScript**

Run: `bun run build`

Expected: clean. The component isn't imported yet, but it must still compile successfully.

- [ ] **Step 4: Run the full test suite as a sanity check**

Run: `bun test`

Expected: `93 pass, 0 fail`. No tests in this task, but existing ones should still pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/labs/prime-moments/ConstellationEmblem.tsx
git commit -m "feat(prime-moments): add programmatic ConstellationEmblem"
```

---

### Task 4: `SharedConstellation` server component

**Files:**

- Create: `src/app/labs/prime-moments/SharedConstellation.tsx`

**Context:** The share view layout. A server component that takes validated offsets, computes lifetime instances via `findLifetimeInstances`, and renders the emblem-forward layout from the spec: label, h1 title, constellation subtitle, instances list, "try your own →" CTA. Intentionally a React fragment (no outer `<main>` wrapper) — the page shell owns the crumb row, toggle, and max-width container. This component slots inside that shell.

- [ ] **Step 1: Create `SharedConstellation.tsx`**

Create `src/app/labs/prime-moments/SharedConstellation.tsx`:

```tsx
// Share view for a shared Prime Moments constellation.
//
// Pure server component. Given validated offsets, computes the
// lifetime instances from math alone (no group data) and renders the
// emblem-forward share view layout.
//
// Slots inside the lab page's main wrapper — the crumb row, toggle,
// and max-width container belong to page.tsx, not this component.

import Link from "next/link";

import ConstellationEmblem from "./ConstellationEmblem";
import { findLifetimeInstances } from "./lib/primeMoments";

interface Props {
  offsets: number[];
}

export default function SharedConstellation({ offsets }: Props) {
  const instances = findLifetimeInstances(offsets);
  const n = offsets.length;
  const instanceCount = instances.length;

  return (
    <>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-[0.55] mb-5">
        someone shared a prime constellation
      </div>

      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-[28px] sm:text-[40px] font-bold leading-[1] tracking-[-0.03em] mb-2">
            a group of {n}
          </h1>
          <div className="font-mono text-[12px] opacity-70">
            constellation [{offsets.join(", ")}]
          </div>
        </div>
        <ConstellationEmblem
          offsets={offsets}
          className="w-[72px] h-[72px] sm:w-[96px] sm:h-[96px] flex-shrink-0 text-ink"
        />
      </div>

      <div className="mb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-[0.55] mb-2">
          {instanceCount} lifetime instance{instanceCount === 1 ? "" : "s"}
        </div>
        {instanceCount === 0 ? (
          <p className="text-[14px] opacity-70">
            This constellation has no all-prime instances within a human
            lifespan.
          </p>
        ) : (
          <div className="font-mono text-[13px] leading-[1.8] break-words">
            {instances.map((ages, i) => (
              <span key={i}>
                {i > 0 && " · "}({ages.join(", ")})
              </span>
            ))}
          </div>
        )}
      </div>

      <Link
        href="/labs/prime-moments"
        className="inline-block font-mono text-[12px] lowercase tracking-[0.04em] px-4 py-2 bg-ink text-paper border border-ink no-underline hover:opacity-90"
      >
        try your own →
      </Link>
    </>
  );
}
```

- [ ] **Step 2: Run lint**

Run: `bun run lint`

Expected: clean.

- [ ] **Step 3: Run the build**

Run: `bun run build`

Expected: clean. Component compiles, not imported anywhere yet.

- [ ] **Step 4: Run tests**

Run: `bun test`

Expected: `93 pass, 0 fail`.

- [ ] **Step 5: Commit**

```bash
git add src/app/labs/prime-moments/SharedConstellation.tsx
git commit -m "feat(prime-moments): add SharedConstellation view component"
```

---

## Phase C — Integrate into existing pages

---

### Task 5: Branch `page.tsx` on `?share=`

**Files:**

- Modify: `src/app/labs/prime-moments/page.tsx`

**Context:** The lab page becomes the router for share-view vs. normal-finder. Made `async` to await `searchParams` (a Promise in Next.js 16). Reads `?share=`, parses via `parseShareParam`, checks admissibility via `isAdmissibleConstellation`, and branches. If the share is valid and admissible → render `<SharedConstellation>` inside the page shell. Otherwise → render the existing finder + prose + viz content as today.

The crumb row, toggle, max-width container, and footer stay outside the branch. Only the "main content" section (lede, meta, finder, prose, viz) gets conditionally replaced.

- [ ] **Step 1: Read the current page.tsx**

Run: `cat src/app/labs/prime-moments/page.tsx`

Take note of the existing structure:

- Top-level imports (Metadata, Link, ThemeToggle, isPrime, PrimeMomentsFinder)
- Constants (`RESEARCH_URL`, `TOUPS_PRIMES`, `CellKind`, `NL_CELL_CLASS`, `NUMBER_LINE_CELLS`)
- Sub-components (`PrimeMomentsEmblem`, `NumberLine`)
- Default export `PrimeMomentsPage` — currently synchronous, no props.

You'll preserve everything except the default export, which gets rewritten to async + branching.

- [ ] **Step 2: Add the new imports**

Near the top of `page.tsx`, add these imports alongside the existing ones:

```tsx
import { isAdmissibleConstellation } from "./lib/primes";
import { parseShareParam } from "./lib/share";
import SharedConstellation from "./SharedConstellation";
```

Note: `isPrime` is already imported from `./lib/primes`. Extend that import line to include `isAdmissibleConstellation`:

```tsx
import { isAdmissibleConstellation, isPrime } from "./lib/primes";
```

- [ ] **Step 3: Replace the `PrimeMomentsPage` default export**

Find the line `export default function PrimeMomentsPage() {` and everything down to its closing brace. Replace the function with this `async` version that branches on the share param:

```tsx
interface PageProps {
  searchParams: Promise<{ share?: string | string[] }>;
}

export default async function PrimeMomentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parsed = parseShareParam(params.share);
  const sharedOffsets =
    parsed !== null && isAdmissibleConstellation(parsed) ? parsed : null;

  return (
    <main className="min-h-screen px-6 py-12 sm:px-16 sm:py-16">
      <div className="mx-auto max-w-[720px]">
        <div className="flex items-center justify-between mb-7">
          <Link
            href="/labs"
            className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 hover:opacity-100 no-underline"
          >
            ← func imp labs
          </Link>
          <ThemeToggle />
        </div>

        {sharedOffsets !== null ? (
          <SharedConstellation offsets={sharedOffsets} />
        ) : (
          <>
            <div className="flex items-start justify-between gap-6 mb-7">
              <h1 className="text-[40px] sm:text-[56px] font-bold leading-[0.95] tracking-[-0.04em]">
                Prime
                <br />
                Moments
              </h1>
              <PrimeMomentsEmblem />
            </div>

            <p className="text-[18px] leading-[1.45] opacity-85 max-w-[38ch] mb-7">
              Calendar windows when every person in a group has a prime age at
              the same time.
            </p>

            <div className="font-mono text-[11px] uppercase tracking-[0.12em] opacity-[0.55] flex gap-5 mb-9">
              <span>lab 01</span>
              <span>2026-04-10</span>
            </div>

            <div className="mb-14">
              <PrimeMomentsFinder />
            </div>

            <div className="prose-hyphens flex flex-col gap-4 text-[16px] leading-[1.65] max-w-[60ch]">
              <p>
                My family hit one of these recently. Sarah just turned 41, and
                before her next birthday I&rsquo;ll turn 43 and Lyra will turn
                11. Three ages, all prime, all at once:{" "}
                <strong>11, 41, 43</strong>.
              </p>
              <p>
                The interesting part isn&rsquo;t the moment itself &mdash;
                it&rsquo;s that the same shape repeats. The offsets{" "}
                <code>[0, 30, 32]</code> hit prime triples at{" "}
                <code>(11, 41, 43)</code>, then again at{" "}
                <code>(29, 59, 61)</code>, <code>(41, 71, 73)</code>, and{" "}
                <code>(71, 101, 103)</code>. A single human family can pass
                through this configuration four times in one lifetime. I
                started calling these <strong>Toups Primes</strong>.
              </p>
            </div>

            <NumberLine />

            <div className="prose-hyphens flex flex-col gap-4 text-[16px] leading-[1.65] max-w-[60ch]">
              <p>
                A <em>prime constellation</em> is the offset shape. A{" "}
                <em>prime moment</em> is what happens when real people with
                real birthdays line up with one of those shapes on the
                calendar.
              </p>
              <p className="text-[16px] opacity-70">
                Footnote on 2: 2 is the only even prime, so any constellation
                that contains it has odd offsets to every other member. Such
                patterns can occur at most once (at base 2) and never repeat.
                The finder uses only odd primes for the recurring patterns
                &mdash; that&rsquo;s where the interesting structure lives.
              </p>
            </div>
          </>
        )}

        <footer className="mt-14 pt-5 border-t border-ink font-mono text-[11px] opacity-55">
          research →{" "}
          <a
            href={RESEARCH_URL}
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
```

Note: the footer stays outside the branch (always shown). The crumb row + toggle also stay outside. Only the main content section is conditional.

- [ ] **Step 4: Run lint**

Run: `bun run lint`

Expected: clean.

- [ ] **Step 5: Run the build**

Run: `bun run build`

Expected: clean. `/labs/prime-moments` stays dynamic (already was because the root layout reads cookies).

- [ ] **Step 6: Run tests**

Run: `bun test`

Expected: `93 pass, 0 fail`.

- [ ] **Step 7: Smoke test the share-view branch manually**

Start the dev server: `bun run dev`

In a browser, navigate to `http://localhost:3000/labs/prime-moments?share=0,30,32`. You should see the share view: "someone shared a prime constellation" label, "a group of 3" heading, `constellation [0, 30, 32]` subtitle, the triangle emblem, the four Toups Primes instance tuples, and the "try your own →" button.

Click "try your own →". It should navigate to `/labs/prime-moments` (no query) and show the normal finder.

Test the invalid fallback: navigate to `http://localhost:3000/labs/prime-moments?share=foo`. You should see the normal finder, not an error. Same for `?share=0,11` (inadmissible — `[0, 11]` fails the mod-2 check).

Stop the dev server (Ctrl+C).

- [ ] **Step 8: Commit**

```bash
git add src/app/labs/prime-moments/page.tsx
git commit -m "feat(prime-moments): branch page.tsx on ?share= param"
```

---

### Task 6: Actions row + share button in `PrimeMomentsFinder`

**Files:**

- Modify: `src/app/labs/prime-moments/PrimeMomentsFinder.tsx`

**Context:** Add a row below the result rows containing a `share` button. The button:

1. Renders only when `results` is non-null AND `totalMoments > 0`.
2. On click, builds the share URL from `results[0].offsets` (always exactly one admissible constellation under the current filter), writes it to `navigator.clipboard`, and flips its label to `copied ✓` for 2 seconds.
3. If `navigator.clipboard` throws (non-HTTPS dev context, rare), falls back to `alert(url)`.

The row uses `flex flex-wrap gap-2` so future siblings (`add to calendar`, etc.) can be appended without restructuring. The button uses the same secondary style as `+ add` — transparent background, ink border, mono lowercase.

- [ ] **Step 1: Read the current PrimeMomentsFinder.tsx**

Run: `cat src/app/labs/prime-moments/PrimeMomentsFinder.tsx`

Note the existing structure:

- Imports: `useId`, `useState` from react; `formatDate` from `@/lib/dates`; `findPrimeMoments` from `./lib/primeMoments`; types from `./lib/types`.
- State: `drafts`, `results`, `error`.
- Derived: `totalMoments`.
- The form block with inputs, add/find buttons, optional error alert.
- The results block with the header and `.flatMap` over constellations + moments.

You'll add: one new import, one new state, one new handler, and one new JSX block (the actions row) inside the results block.

- [ ] **Step 2: Add the `encodeShareParam` import**

Near the top of the file, add alongside the existing `./lib/*` imports:

```tsx
import { encodeShareParam } from "./lib/share";
```

Place it below the `formatDate` import and above the `findPrimeMoments` import, alphabetized by module.

- [ ] **Step 3: Add `copied` state**

Find the line `const [error, setError] = useState<string | null>(null);` and immediately after it, add:

```tsx
  const [copied, setCopied] = useState(false);
```

- [ ] **Step 4: Add the `onShare` handler**

Find the end of the `calculate` function (its closing brace) and immediately after it, add:

```tsx

  const onShare = async () => {
    if (!results || results.length === 0) return;
    const offsets = results[0].offsets;
    const url = `${window.location.origin}/labs/prime-moments?share=${encodeShareParam(offsets)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS dev context).
      // Fall back to showing the URL so the sharer can copy manually.
      // eslint-disable-next-line no-alert
      alert(url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
```

- [ ] **Step 5: Add the actions row to the results JSX**

Find the JSX block that renders results. It currently ends with something like:

```tsx
            {results.flatMap((c) =>
              c.moments.map((m) => (
                // ... row markup ...
              )),
            )}
          </div>
        </div>
      )}
    </section>
  );
}
```

Just before the `</div>` that closes the results' inner `<div className="flex flex-col">`, the structure is:

```tsx
        <div className="mt-10">
          <h3>...</h3>
          <div className="flex flex-col">
            {/* result rows */}
          </div>
        </div>
```

Add the actions row after the `</div>` that closes `flex flex-col` and before the `</div>` that closes `mt-10`. The whole block becomes:

```tsx
      {results && (
        <div className="mt-10">
          <h3 className="text-lg font-semibold mb-4">
            {totalMoments === 0
              ? "No prime moments found."
              : `${totalMoments} prime moment${totalMoments === 1 ? "" : "s"} — constellation [${results[0].offsets.join(", ")}]`}
          </h3>

          <div className="flex flex-col">
            {results.flatMap((c) =>
              c.moments.map((m) => (
                <div
                  key={`${c.offsets.join(",")}-${m.startDate}-${m.endDate}`}
                  className="border-t border-ink py-4 grid grid-cols-[140px_1fr] gap-6"
                >
                  <div className="font-mono text-[12px]">
                    {formatDate(m.startDate)}
                    <br />
                    {formatDate(m.endDate)}
                  </div>
                  <div className="text-[14px]">
                    {m.ages.map((a, i) => (
                      <span key={a.name}>
                        {i > 0 && " · "}
                        {a.name}{" "}
                        <span className="font-mono font-bold">{a.age}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )),
            )}
          </div>

          {totalMoments > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onShare}
                aria-label={copied ? "Share URL copied" : "Copy share URL"}
                className="font-mono text-[12px] lowercase tracking-[0.04em] px-4 py-2 bg-transparent text-ink border border-ink cursor-pointer hover:bg-ink/5"
              >
                {copied ? "copied ✓" : "share"}
              </button>
            </div>
          )}
        </div>
      )}
```

The `{totalMoments > 0 && (...)}` guard means the actions row never renders in the "No prime moments found." state.

- [ ] **Step 6: Run lint**

Run: `bun run lint`

Expected: clean. The `// eslint-disable-next-line no-alert` comment is there because the fallback path uses `alert()`, which `eslint-config-next` flags by default.

- [ ] **Step 7: Run the build**

Run: `bun run build`

Expected: clean.

- [ ] **Step 8: Run tests**

Run: `bun test`

Expected: `93 pass, 0 fail`.

- [ ] **Step 9: Smoke test end-to-end manually**

Start the dev server: `bun run dev`

Open `http://localhost:3000/labs/prime-moments`. Enter the reference group (Eve 2013-07-01, Alice 1982-10-05, Bob 1981-09-05). Click "find prime moments".

Expected:

- Results render with the two-line header: `"4 prime moments"` and `"constellation [0, 30, 32]"`.
- Below the result rows, a `share` button appears.
- Click the button. Its label flips to `copied ✓` for 2 seconds, then reverts.
- Paste the clipboard contents into a new browser tab. The URL is `http://localhost:3000/labs/prime-moments?share=0,30,32`.
- Loading that URL shows the share view (the emblem, the title, the four instances).
- Click "try your own →" on the share view. You land back on the empty finder.

Stop the dev server (Ctrl+C).

- [ ] **Step 10: Commit**

```bash
git add src/app/labs/prime-moments/PrimeMomentsFinder.tsx
git commit -m "feat(prime-moments): add actions row with share button"
```

---

## Phase D — Verification

---

### Task 7: End-to-end verification

**Files:**

- Read-only.

**Context:** Final sanity pass across everything. Automated checks confirm nothing regressed. Manual checks confirm the privacy model holds and the UX flows work. No commit from this task.

- [ ] **Step 1: Automated full check**

Run: `bun install && bun run lint && bun run build && bun test`

Expected:

- `bun install`: no changes (no new deps).
- `bun run lint`: clean.
- `bun run build`: clean. All four routes still dynamic (`ƒ`).
- `bun test`: `93 pass, 0 fail`.

- [ ] **Step 2: Privacy audit by grep**

Run: `grep -rn "birthDate\|setError\|draft\|updateDraft" src/app/labs/prime-moments/SharedConstellation.tsx src/app/labs/prime-moments/ConstellationEmblem.tsx src/app/labs/prime-moments/lib/share.ts`

Expected: **no matches**. None of the share-side code should reference group-member data, form state, or anything tied to a specific user's input. If any of these terms appear in those files, something is wrong — the share payload is supposed to be offsets-only.

- [ ] **Step 3: URL parser edge cases**

Run: `bun test src/app/labs/prime-moments/lib/share.test.ts -v`

Scan the output for the 11 invalid-input rejection tests. All should pass. If any unexpectedly passes (i.e., accepts something the spec says to reject), the validator has a gap.

- [ ] **Step 4: Manual end-to-end (dev server)**

Run: `bun run dev`

In a browser, walk these paths in order:

1. **Home → Labs → Prime Moments.** Navigate via the site chrome. Verify the normal finder renders (form + prose + viz).
2. **Empty finder share check.** Without submitting anything, confirm there's NO share button. The actions row doesn't exist before results.
3. **Submit a group and share.** Enter Eve 2013-07-01, Alice 1982-10-05, Bob 1981-09-05. Click `find prime moments`. Verify the two-line header reads `"4 prime moments"` / `"constellation [0, 30, 32]"`. Verify the `share` button appears below the result rows. Click it. Verify the label flips to `copied ✓` for ~2 seconds then reverts.
4. **Paste and verify the URL shape.** Paste the clipboard contents into a new tab's address bar. The URL should be `http://localhost:3000/labs/prime-moments?share=0,30,32`. Load it.
5. **Share view renders correctly.** The page should show:
   - Crumb `← func imp labs` and the theme toggle, unchanged.
   - The mono label `"someone shared a prime constellation"`.
   - A heading `"a group of 3"` and a mono subtitle `"constellation [0, 30, 32]"`.
   - The programmatic triangle emblem on the right, filled with dither, inverting cleanly with theme (test both modes via the toggle).
   - A label `"4 lifetime instances"` and four parenthesized triples: `(11, 41, 43) · (29, 59, 61) · (41, 71, 73) · (71, 101, 103)`.
   - A `try your own →` button (flat, ink-on-paper inverted).
   - The footer research link, unchanged.
   - No form anywhere on the page.
6. **"Try your own" exit.** Click the `try your own →` button. Expect to land on `/labs/prime-moments` (no query) with the normal finder visible, empty.
7. **Invalid share → fallback.** In the address bar, navigate to `http://localhost:3000/labs/prime-moments?share=foo`. Expect the normal finder to render. No error, no redirect, no flash.
8. **Inadmissible share → fallback.** Navigate to `http://localhost:3000/labs/prime-moments?share=0,11`. `[0, 11]` is inadmissible (fails the mod-2 residue check). Expect the normal finder to render. No error.
9. **Empty share value.** Navigate to `http://localhost:3000/labs/prime-moments?share=`. Expect the normal finder to render.
10. **Solo group share.** Navigate to `http://localhost:3000/labs/prime-moments?share=0`. Expect the share view with `"a group of 1"`, a single filled dot as the emblem, and 29 single-element tuples listed `(3) · (5) · (7) · ... · (113)`.
11. **Larger group share.** Navigate to `http://localhost:3000/labs/prime-moments?share=0,6,12,18,24`. This is inadmissible (covers all residues mod 5 — has exactly one instance at p=5). Expect fallback to normal finder.
12. **Theme persistence.** On any share view, click the toggle. Verify the theme flips, the emblem inverts, the button and text invert. Reload. Verify the theme persists and the share view still renders correctly.

Stop the dev server (Ctrl+C).

- [ ] **Step 5: Confirm git log**

Run: `git log --oneline -10`

Expected: the last six commits are (in reverse order, newest first):

```text
feat(prime-moments): add actions row with share button
feat(prime-moments): branch page.tsx on ?share= param
feat(prime-moments): add SharedConstellation view component
feat(prime-moments): add programmatic ConstellationEmblem
feat(prime-moments): add share URL encoder and parser
feat(prime-moments): add findLifetimeInstances helper
```

No commits touched any file outside `src/app/labs/prime-moments/` (other than the pre-existing lib files there).

- [ ] **Step 6: No additional commit — verification only.**

---

## Done

After Task 7:

- Sharing is shipped end-to-end. Users can copy a share URL, viewers see a read-only share view, invalid shares fall through silently.
- Privacy model is enforced by construction: the share payload is offsets-only, validated on parse, admissibility-checked before render.
- The actions row is in place as the future home for `add to calendar` and other sibling affordances.
- 93 tests passing (72 pre-existing + 5 for `findLifetimeInstances` + 21 for `share.ts`).
- All four routes still render (dynamic). No new routes added. No new dependencies.

The lab page branch on `?share=` is stable enough to support future labs wanting the same read-only share pattern — the implementation shape (parse in `page.tsx`, render a dedicated component, link back to empty state) is portable.
