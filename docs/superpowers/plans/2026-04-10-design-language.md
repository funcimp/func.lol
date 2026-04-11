# func.lol Design Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current daisyUI-based UI with a hand-authored, distinctive design language (modern minimal × hacker × dither), drop daisyUI as a dependency, add a cookie-based light/dark toggle with zero flash, and codify the rules in a durable `DESIGN.md`.

**Architecture:** Tailwind v4 alone, with design tokens declared in an `@theme` block in `globals.css`. Light/dark switched via `data-theme` attribute on `<html>`, set by the root layout (async server component) reading a `theme` cookie via `next/headers`. A small client `<ThemeToggle>` writes the cookie and updates the DOM on click. Two new components: `<FuncImpMark>` (inline SVG of the brand mark, follows `currentColor`) and `<ThemeToggle>`. Pages refactored bottom-up so the build is never visually broken between commits.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, `next/font/google` (Inter + JetBrains Mono), bun (package manager + test runner).

**Spec:** [docs/superpowers/specs/2026-04-10-design-language-design.md](../specs/2026-04-10-design-language-design.md)

---

## File map

### Files created

- `src/components/FuncImpMark.tsx` — inline SVG brand mark using `currentColor`.
- `src/components/ThemeToggle.tsx` — client component, mono icon button, reads/writes `theme` cookie, updates `data-theme` on `<html>`.
- `DESIGN.md` (repo root) — durable design language reference distilled from the spec.

### Files modified

- `src/app/globals.css` — Tailwind v4 `@theme` tokens, base typography, dark override; daisyUI plugin dropped in Phase C.
- `src/app/layout.tsx` — async server component, reads `theme` cookie, adds Inter + JetBrains Mono fonts, applies tokens.
- `src/app/page.tsx` — use `<FuncImpMark>`, add `<ThemeToggle>`, drop `next/image`.
- `src/app/labs/page.tsx` — drop daisyUI, hairline list, add `<ThemeToggle>`.
- `src/app/labs/prime-moments/page.tsx` — synthesis mockup as the actual page: header row with emblem, lede, meta, prose, V2 number line, form, results.
- `src/app/labs/prime-moments/PrimeMomentsFinder.tsx` — drop every daisyUI class. **Lib unchanged, 53 tests still pass.**
- `package.json` — drop `daisyui` from `devDependencies`.
- `AGENTS.md` — reference `DESIGN.md`.

### Files unchanged

- `src/app/labs/prime-moments/lib/*` — 53 tests still pass.
- `research/*`, `IDEAS.md`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vercel.json`, `public/funcimp.svg`.

### Files removed

None.

---

## Phase outline

- **Phase A** — add tokens and new components, no visible UI change. Tasks 1–3.
- **Phase B** — refactor pages bottom-up (finder → lab page → labs index → landing → layout). Tasks 4–8.
- **Phase C** — drop daisyUI, write durable docs, final verification. Tasks 9–14.

Tasks are inserted below this line, one at a time, via subsequent edits.

---

## Phase A — Tokens and components (no UI changes yet)

Both daisyUI and the new tokens coexist briefly. New components exist but are not yet imported by any page.

---

### Task 1: Add Tailwind v4 `@theme` tokens and base styles to `globals.css`

**Files:**

- Modify: `src/app/globals.css`

**Context:** Tailwind v4 declares design tokens via an `@theme` block. Tokens prefixed `--color-*` automatically generate matching utilities (`bg-paper`, `text-ink`, `border-ink`, etc.). The dark-mode override is a regular CSS rule that flips the same custom properties under `[data-theme="dark"]`. The `@plugin "daisyui"` line stays for now — it gets removed in Task 10 after all pages have been refactored.

- [ ] **Step 1: Read the current globals.css**

Run: `cat src/app/globals.css`

Expected current contents:

```css
@import "tailwindcss";
@plugin "daisyui" {
  themes: dark --default;
}
```

- [ ] **Step 2: Replace `globals.css` with the new token system (keeping daisyUI for now)**

Write the full file:

```css
@import "tailwindcss";

/* Keep daisyUI installed during the transition. It will be removed in
   Task 10 after every page has been refactored to not reference its
   component classes. */
@plugin "daisyui" {
  themes: dark --default;
}

/* ============================================================
   Design tokens
   ------------------------------------------------------------
   Human-readable names (paper, ink, subtle) are used in DESIGN.md.
   In Tailwind v4's @theme they require the --color- prefix, which
   generates utilities like bg-paper and text-ink.
   ============================================================ */

@theme {
  --color-paper: #f5f3ec;
  --color-ink: #161616;
  --color-subtle: #ebe7d4;

  --font-sans: var(--font-inter), ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, "SF Mono", Menlo, monospace;
}

/* Dark-mode override. The server-rendered layout sets
   data-theme="dark" or "light" on <html>; this rule flips the tokens
   when dark is active. */
[data-theme="dark"] {
  --color-paper: #0f0e0c;
  --color-ink: #ede9d8;
  --color-subtle: #1c1a16;
}

/* ============================================================
   Base typography and prose niceties
   ============================================================ */

@layer base {
  html {
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  body {
    line-height: 1.5;
  }

  .prose-hyphens {
    hyphens: auto;
    -webkit-hyphens: auto;
  }

  *,
  *::before,
  *::after {
    border-radius: 0;
  }

  code {
    font-family: var(--font-mono);
    background-color: var(--color-subtle);
    padding: 1px 6px;
    font-size: 0.9em;
  }

  :focus-visible {
    outline: 1px solid var(--color-ink);
    outline-offset: 2px;
  }
}
```

- [ ] **Step 3: Verify the build still passes**

Run: `bun run build`
Expected: clean build. Existing pages still use daisyUI classes which still resolve.

- [ ] **Step 4: Verify tests still pass**

Run: `bun test`
Expected: `53 pass, 0 fail`.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): add design language tokens to globals.css"
```

---

### Task 2: Create `<FuncImpMark>` component

**Files:**

- Create: `src/components/FuncImpMark.tsx`

**Context:** The current `public/funcimp.svg` is a 1020×900 SVG with a black `<rect>` background and white pixel-art `FUNC` and `IMP` letterforms. To make it follow the theme, we inline the paths as a React component, drop the background rectangle, and replace white fills with `currentColor`. The component then renders in whatever ink color the surrounding theme provides.

- [ ] **Step 1: Read the source SVG**

Run: `cat public/funcimp.svg`

Expected: an `<svg viewBox="0 0 1020 900">` containing one `<rect fill="#000000">` (**drop this**), a `<g id="IMP" transform="translate(120, 420)" fill="#FFFFFF">` with three `<path>` elements, and a `<g id="FUNC" transform="translate(60, 60)" fill="#FFFFFF">` with four `<path>` elements.

- [ ] **Step 2: Create the component file**

Write `src/components/FuncImpMark.tsx` with the SVG paths copied byte-for-byte from the source. Drop the background `<rect>`. Replace both `fill="#FFFFFF"` attributes on the `<g>` elements with `fill="currentColor"`. Accept `SVGProps<SVGSVGElement>` so callers can pass className, width, etc.

```tsx
import type { SVGProps } from "react";

/**
 * The funcimp brand mark, inlined as an SVG component.
 * Uses currentColor so it follows the surrounding text color —
 * black on cream in light mode, off-white on near-black in dark
 * mode, automatically.
 */
export default function FuncImpMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1020 900"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="func imp"
      {...props}
    >
      <g transform="translate(60, 60)" fill="currentColor">
        <path d="M0,0 L60,0 L60,60 L0,60 L0,0 Z M0,60 L60,60 L60,120 L0,120 L0,60 Z M0,120 L60,120 L60,180 L0,180 L0,120 Z M0,180 L60,180 L60,240 L0,240 L0,180 Z M60,0 L120,0 L120,60 L60,60 L60,0 Z M120,0 L180,0 L180,60 L120,60 L120,0 Z M60,120 L120,120 L120,180 L60,180 L60,120 Z M0,240 L60,240 L60,300 L0,300 L0,240 Z" />
        <path d="M241,120 L301,120 L301,180 L241,180 L241,120 Z M241,180 L301,180 L301,240 L241,240 L241,180 Z M241,240 L301,240 L301,300 L241,300 L241,240 Z M301,240 L361,240 L361,300 L301,300 L301,240 Z M361,240 L421,240 L421,300 L361,300 L361,240 Z M361,180 L421,180 L421,240 L361,240 L361,180 Z M361,120 L421,120 L421,180 L361,180 L361,120 Z" />
        <path d="M480,120 L540,120 L540,180 L480,180 L480,120 Z M480,180 L540,180 L540,240 L480,240 L480,180 Z M480,240 L540,240 L540,300 L480,300 L480,240 Z M480,60 L540,60 L540,120 L480,120 L480,60 Z M540,120 L600,120 L600,180 L540,180 L540,120 Z M600,120 L660,120 L660,180 L600,180 L600,120 Z M600,180 L660,180 L660,240 L600,240 L600,180 Z M600,240 L660,240 L660,300 L600,300 L600,240 Z" />
        <path d="M720,240 L780,240 L780,300 L720,300 L720,240 Z M720,180 L780,180 L780,240 L720,240 L720,180 Z M720,120 L780,120 L780,180 L720,180 L720,120 Z M780,240 L840,240 L840,300 L780,300 L780,240 Z M840,240 L900,240 L900,300 L840,300 L840,240 Z M720,60 L780,60 L780,120 L720,120 L720,60 Z M780,60 L840,60 L840,120 L780,120 L780,60 Z M840,60 L900,60 L900,120 L840,120 L840,60 Z" />
      </g>
      <g transform="translate(120, 420)" fill="currentColor">
        <path d="M0,0 L60,0 L60,60 L0,60 L0,0 Z M60,0 L120,0 L120,60 L60,60 L60,0 Z M120,0 L180,0 L180,60 L120,60 L120,0 Z M60,60 L120,60 L120,120 L60,120 L60,60 Z M60,120 L120,120 L120,180 L60,180 L60,120 Z M60,180 L120,180 L120,240 L60,240 L60,180 Z M0,240 L60,240 L60,300 L0,300 L0,240 Z M60,240 L120,240 L120,300 L60,300 L60,240 Z M120,240 L180,240 L180,300 L120,300 L120,240 Z" />
        <path d="M240,240 L300,240 L300,300 L240,300 L240,240 Z M240,180 L300,180 L300,240 L240,240 L240,180 Z M240,120 L300,120 L300,180 L240,180 L240,120 Z M300,180 L360,180 L360,240 L300,240 L300,180 Z M240,300 L300,300 L300,360 L240,360 L240,300 Z M360,180 L420,180 L420,240 L360,240 L360,180 Z M360,240 L420,240 L420,300 L360,300 L360,240 Z M360,300 L420,300 L420,360 L360,360 L360,300 Z M360,120 L420,120 L420,180 L360,180 L360,120 Z M420,120 L480,120 L480,180 L420,180 L420,120 Z M480,120 L540,120 L540,180 L480,180 L480,120 Z M480,180 L540,180 L540,240 L480,240 L480,180 Z M480,240 L540,240 L540,300 L480,300 L480,240 Z M480,300 L540,300 L540,360 L480,360 L480,300 Z" />
        <path d="M600,120 L660,120 L660,180 L600,180 L600,120 Z M600,180 L660,180 L660,240 L600,240 L600,180 Z M600,240 L660,240 L660,300 L600,300 L600,240 Z M600,300 L660,300 L660,360 L600,360 L600,300 Z M600,360 L660,360 L660,420 L600,420 L600,360 Z M600,60 L660,60 L660,120 L600,120 L600,60 Z M660,60 L720,60 L720,120 L660,120 L660,60 Z M720,60 L780,60 L780,120 L720,120 L720,60 Z M720,120 L780,120 L780,180 L720,180 L720,120 Z M720,180 L780,180 L780,240 L720,240 L720,180 Z M660,180 L720,180 L720,240 L660,240 L660,180 Z" />
      </g>
    </svg>
  );
}
```

- [ ] **Step 3: Run lint and build**

Run: `bun run lint && bun run build`
Expected: clean. Component compiles but isn't imported anywhere yet.

- [ ] **Step 4: Commit**

```bash
git add src/components/FuncImpMark.tsx
git commit -m "feat(design): add FuncImpMark component"
```

---

### Task 3: Create `<ThemeToggle>` component (cookie-based)

**Files:**

- Create: `src/components/ThemeToggle.tsx`

**Context:** Client component that reads the current theme from the DOM (set by the SSR'd layout in Task 8) and on click writes the new value to both the `theme` cookie AND the `data-theme` attribute. No `localStorage`. No inline pre-paint script. The cookie is read by the root layout on subsequent requests via `cookies()` from `next/headers`, so navigation and reload render the correct theme directly in the HTML with zero flash.

The component renders a placeholder on first render (before `useEffect` runs) so the server HTML and client first render agree — the real glyph swaps in after mount. This is a one-frame no-op for users, invisible in practice.

- [ ] **Step 1: Create the component file**

Write `src/components/ThemeToggle.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function readCurrentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" ? "light" : "dark";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(readCurrentTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  if (theme === null) {
    return (
      <span
        aria-hidden="true"
        className="inline-block w-[1.2em] h-[1.2em] font-mono text-[14px]"
      />
    );
  }

  const isLight = theme === "light";
  const glyph = isLight ? "☾" : "☼";
  const label = isLight ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="font-mono text-[14px] leading-none text-ink opacity-70 hover:opacity-100 transition-opacity bg-transparent border-0 p-0 cursor-pointer"
    >
      {glyph}
    </button>
  );
}
```

- [ ] **Step 2: Run lint and build**

Run: `bun run lint && bun run build`
Expected: clean. Component compiles; not imported anywhere yet.

- [ ] **Step 3: Commit**

```bash
git add src/components/ThemeToggle.tsx
git commit -m "feat(design): add ThemeToggle component"
```

---

## Phase B — Refactor pages bottom-up

Each task swaps one page's daisyUI classes for design tokens. Order is innermost (the finder) → outermost (layout). After Task 8, no source file references daisyUI classes, though the daisyUI plugin is still loaded in `globals.css` (dropped in Task 10).

---

### Task 4: Refactor `PrimeMomentsFinder.tsx`

**Files:**

- Modify: `src/app/labs/prime-moments/PrimeMomentsFinder.tsx`

**Context:** The interactive client component for the family list and results. Currently uses `card`, `card-body`, `card-title`, `btn`, `btn-primary`, `btn-ghost`, `btn-square`, `btn-sm`, `input`, `input-bordered`, `alert`, `alert-warning`, `bg-base-100`, `bg-base-200`, `border-base-300`. **All daisyUI classes go.** Replace with raw Tailwind utilities + the new tokens. The TypeScript logic and the `findPrimeMoments` import stay unchanged. The 53 lib tests must still pass with no edits to lib files.

- [ ] **Step 1: Read the current file**

Run: `cat src/app/labs/prime-moments/PrimeMomentsFinder.tsx`

Note: the state shape (`Draft[]`, `Constellation[] | null`, `error`), the helper functions (`newDraft`, `formatDate`, `updateDraft`, `removeDraft`, `addDraft`, `calculate`), the `useId` hook, and the render structure.

- [ ] **Step 2: Replace the file**

Write `src/app/labs/prime-moments/PrimeMomentsFinder.tsx`:

```tsx
"use client";

import { useId, useState } from "react";

import { findPrimeMoments } from "./lib/primeMoments";
import type { Constellation, FamilyMember } from "./lib/types";

type Draft = Pick<FamilyMember, "id" | "name" | "birthDate">;

const newDraft = (): Draft => ({
  id: crypto.randomUUID(),
  name: "",
  birthDate: "",
});

const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

export default function PrimeMomentsFinder() {
  const formId = useId();
  const [drafts, setDrafts] = useState<Draft[]>([newDraft(), newDraft()]);
  const [results, setResults] = useState<Constellation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeDraft = (id: string) => {
    setDrafts((prev) =>
      prev.length > 1 ? prev.filter((d) => d.id !== id) : prev,
    );
  };

  const addDraft = () => {
    setDrafts((prev) => [...prev, newDraft()]);
  };

  const calculate = () => {
    setError(null);
    const valid = drafts
      .filter((d) => d.name.trim() && d.birthDate)
      .map((d) => ({ id: d.id, name: d.name.trim(), birthDate: d.birthDate }));
    if (valid.length === 0) {
      setError("Add at least one family member with a name and birthday.");
      setResults(null);
      return;
    }
    setResults(findPrimeMoments(valid));
  };

  const totalMoments = results?.reduce((n, c) => n + c.moments.length, 0) ?? 0;

  return (
    <section aria-labelledby={`${formId}-heading`} className="w-full">
      <div className="border-t border-ink pt-7">
        <h2
          id={`${formId}-heading`}
          className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-50 mb-3"
        >
          your family
        </h2>
        <p className="text-[11px] opacity-50 mb-5 font-mono">
          everything runs in your browser. nothing is sent or stored.
        </p>

        <div className="flex flex-col gap-2.5">
          {drafts.map((d, idx) => (
            <div key={d.id} className="flex flex-wrap gap-3 items-baseline">
              <label className="sr-only" htmlFor={`${formId}-name-${d.id}`}>
                Name for member {idx + 1}
              </label>
              <input
                id={`${formId}-name-${d.id}`}
                type="text"
                placeholder="name"
                value={d.name}
                onChange={(e) => updateDraft(d.id, { name: e.target.value })}
                className="font-mono text-[13px] bg-transparent border-0 border-b border-ink px-0 py-0.5 w-32 placeholder:opacity-40 focus:outline-none"
              />
              <label className="sr-only" htmlFor={`${formId}-date-${d.id}`}>
                Birthday for member {idx + 1}
              </label>
              <input
                id={`${formId}-date-${d.id}`}
                type="date"
                value={d.birthDate}
                onChange={(e) => updateDraft(d.id, { birthDate: e.target.value })}
                className="font-mono text-[13px] bg-transparent border-0 border-b border-ink px-0 py-0.5 focus:outline-none"
              />
              {drafts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDraft(d.id)}
                  aria-label={`Remove member ${idx + 1}`}
                  className="font-mono text-[14px] opacity-40 hover:opacity-100 bg-transparent border-0 p-1 cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          <button
            type="button"
            onClick={addDraft}
            className="font-mono text-[12px] lowercase tracking-[0.04em] px-4 py-2 bg-transparent text-ink border border-ink cursor-pointer hover:bg-ink/5"
          >
            + add
          </button>
          <button
            type="button"
            onClick={calculate}
            className="font-mono text-[12px] lowercase tracking-[0.04em] px-4 py-2 bg-ink text-paper border border-ink cursor-pointer hover:opacity-90"
          >
            find prime moments
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 font-mono text-[12px] border-t border-ink pt-3">
            {error}
          </div>
        )}
      </div>

      {results && (
        <div className="mt-10">
          <h3 className="text-lg font-semibold mb-4">
            {totalMoments === 0
              ? "No prime moments found."
              : `${totalMoments} prime moment${totalMoments === 1 ? "" : "s"} · ${results.length} constellation${results.length === 1 ? "" : "s"}`}
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
                  <div>
                    <div className="text-[14px]">
                      {m.ages.map((a, i) => (
                        <span key={a.name}>
                          {i > 0 && " · "}
                          {a.name}{" "}
                          <span className="font-mono font-bold">{a.age}</span>
                        </span>
                      ))}
                    </div>
                    <div className="font-mono text-[11px] opacity-55 mt-1">
                      [{c.offsets.join(", ")}]
                    </div>
                  </div>
                </div>
              )),
            )}
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Run lint, build, tests**

Run: `bun run lint && bun run build && bun test`
Expected: lint clean, build clean, `53 pass, 0 fail`.

- [ ] **Step 4: Commit**

```bash
git add src/app/labs/prime-moments/PrimeMomentsFinder.tsx
git commit -m "refactor(prime-moments): drop daisyUI from PrimeMomentsFinder"
```

---

### Task 5: Refactor `/labs/prime-moments/page.tsx` as the synthesis mockup

**Files:**

- Modify: `src/app/labs/prime-moments/page.tsx`
- Modify: `src/app/globals.css` (append V2 number-line styles)

**Context:** The server component that wraps `<PrimeMomentsFinder>` with the writeup. Rebuild it to match the synthesis mockup the maintainer approved: header row with the `[0, 30, 32]` constellation emblem, lede, mono meta strip, prose, V2 number line, more prose, the finder, a research footer link. Toggle in the top-right. Two files change in this task: the page itself, and `globals.css` for the number-line CSS classes.

- [ ] **Step 1: Append V2 number-line styles to `globals.css`**

Edit `src/app/globals.css` and add this block inside the existing `@layer base { ... }` (just before its closing `}`):

```css
  /* ============================================================
     Prime Moments — number line data viz (V2 dither)
     ============================================================ */
  .number-line {
    display: grid;
    grid-template-columns: repeat(122, 1fr);
    gap: 1px;
    height: 22px;
  }
  .nl-cell {
    background: transparent;
  }
  .nl-cell.prime {
    background-image: radial-gradient(
      circle at 50% 50%,
      var(--color-ink) 38%,
      transparent 39%
    );
    background-size: 2px 2px;
  }
  .nl-cell.toups {
    background: var(--color-ink);
  }
```

- [ ] **Step 2: Replace `page.tsx`**

Write `src/app/labs/prime-moments/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

import PrimeMomentsFinder from "./PrimeMomentsFinder";

export const metadata: Metadata = {
  title: "Prime Moments — func.lol",
  description:
    "Find the calendar windows when every member of your family has a prime age at the same time.",
};

const RESEARCH_URL =
  "https://github.com/funcimp/func.lol/tree/main/research/prime-moments";

const TOUPS_PRIMES = new Set([11, 41, 43, 29, 59, 61, 71, 73, 101, 103]);

function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}

function PrimeMomentsEmblem() {
  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      className="w-[72px] h-[72px] sm:w-[96px] sm:h-[96px] flex-shrink-0"
      role="img"
      aria-label="Prime Moments [0, 30, 32] constellation"
    >
      <defs>
        <pattern id="pm-emblem-dot" width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.6" fill="currentColor" />
        </pattern>
      </defs>
      <circle cx="14" cy="72" r="6" fill="currentColor" />
      <circle cx="62" cy="36" r="6" fill="currentColor" />
      <circle cx="80" cy="30" r="6" fill="currentColor" />
      <line x1="14" y1="72" x2="62" y2="36" stroke="currentColor" strokeWidth="0.7" />
      <line x1="14" y1="72" x2="80" y2="30" stroke="currentColor" strokeWidth="0.7" />
      <line x1="62" y1="36" x2="80" y2="30" stroke="currentColor" strokeWidth="0.7" />
      <path d="M 14 72 L 62 36 L 80 30 Z" fill="url(#pm-emblem-dot)" opacity="0.7" />
    </svg>
  );
}

function NumberLine() {
  const cells: Array<"prime" | "toups" | "none"> = [];
  for (let n = 1; n <= 122; n++) {
    if (TOUPS_PRIMES.has(n)) cells.push("toups");
    else if (isPrime(n)) cells.push("prime");
    else cells.push("none");
  }
  return (
    <figure className="my-8">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-55 mb-2 flex justify-between">
        <span>primes under 122</span>
        <span>solid = toups primes</span>
      </div>
      <div className="number-line">
        {cells.map((kind, i) => (
          <div
            key={i}
            className={
              kind === "toups"
                ? "nl-cell toups"
                : kind === "prime"
                  ? "nl-cell prime"
                  : "nl-cell"
            }
          />
        ))}
      </div>
      <div className="font-mono text-[9px] opacity-55 mt-1 flex justify-between">
        <span>1</span>
        <span>30</span>
        <span>60</span>
        <span>90</span>
        <span>122</span>
      </div>
    </figure>
  );
}

export default function PrimeMomentsPage() {
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

        <div className="flex items-start justify-between gap-6 mb-7">
          <h1 className="text-[40px] sm:text-[56px] font-bold leading-[0.95] tracking-[-0.04em]">
            Prime
            <br />
            Moments
          </h1>
          <PrimeMomentsEmblem />
        </div>

        <p className="text-[18px] leading-[1.45] opacity-85 max-w-[38ch] mb-7">
          Calendar windows when every member of a family has a prime age at the
          same time.
        </p>

        <div className="font-mono text-[11px] opacity-50 flex gap-5 mb-9">
          <span>lab 01</span>
          <span>2026-04-10</span>
          <span>~6 min read</span>
        </div>

        <div className="prose-hyphens flex flex-col gap-4 text-[16px] leading-[1.65] max-w-[60ch]">
          <p>
            My family hit one of these recently. Sarah just turned 41, and
            before her next birthday I&rsquo;ll turn 43 and Lyra will turn 11.
            Three ages, all prime, all at once: <strong>11, 41, 43</strong>.
          </p>
          <p>
            The interesting part isn&rsquo;t the moment itself &mdash; it&rsquo;s
            that the same shape repeats. The offsets <code>[0, 30, 32]</code>
            hit prime triples at <code>(11, 41, 43)</code>, then again at{" "}
            <code>(29, 59, 61)</code>, <code>(41, 71, 73)</code>, and{" "}
            <code>(71, 101, 103)</code>. A single human family can pass through
            this configuration four times in one lifetime. I started calling
            these <strong>Toups Primes</strong>.
          </p>
        </div>

        <NumberLine />

        <div className="prose-hyphens flex flex-col gap-4 text-[16px] leading-[1.65] max-w-[60ch]">
          <p>
            A <em>prime constellation</em> is the offset shape. A{" "}
            <em>prime moment</em> is what happens when a real family with real
            birthdays lines up with one of those shapes on the calendar. Try
            yours below.
          </p>
          <p className="text-[14px] opacity-70">
            Footnote on 2: 2 is the only even prime, so any constellation that
            contains it has odd offsets to every other member. Such patterns can
            occur at most once (at base 2) and never repeat. The finder uses
            only odd primes for the recurring patterns &mdash; that&rsquo;s
            where the interesting structure lives.
          </p>
        </div>

        <div className="mt-10">
          <PrimeMomentsFinder />
        </div>

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

- [ ] **Step 3: Run lint, build, tests**

Run: `bun run lint && bun run build && bun test`
Expected: all clean, 53 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/labs/prime-moments/page.tsx src/app/globals.css
git commit -m "refactor(prime-moments): synthesis mockup as the lab page"
```

---

### Task 6: Refactor `/labs/page.tsx` (labs index)

**Files:**

- Modify: `src/app/labs/page.tsx`

**Context:** Currently uses daisyUI `card` / `card-body` / `card-title` for the lab list. Refactor to a hairline-separated list with mono date metadata and sans titles. Add the toggle. Keep the existing `Lab` type and `labs` array unchanged.

- [ ] **Step 1: Read the current file**

Run: `cat src/app/labs/page.tsx`

- [ ] **Step 2: Replace `page.tsx`**

Write `src/app/labs/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Labs — func.lol",
  description: "Lab experiments by Functionally Imperative.",
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
      "Find the calendar windows when every member of your family has a prime age at the same time.",
    publishedAt: "2026-04-10",
    links: {
      github: "https://github.com/funcimp/func.lol/tree/main/research/prime-moments",
    },
  },
];

const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

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
            func imp labs
          </h1>
          <p className="text-[18px] leading-[1.45] opacity-85 max-w-[38ch] mt-3">
            Small, self-contained experiments. Built in public.
          </p>
        </header>

        <ul className="flex flex-col">
          {labs.map((lab) => (
            <li key={lab.slug} className="border-t border-ink last:border-b">
              <Link
                href={`/labs/${lab.slug}`}
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
```

- [ ] **Step 3: Run lint and build**

Run: `bun run lint && bun run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/labs/page.tsx
git commit -m "refactor(labs): drop daisyUI from labs index"
```

---

### Task 7: Refactor `/page.tsx` (landing)

**Files:**

- Modify: `src/app/page.tsx`

**Context:** Currently a centered `next/image` of the funcimp SVG with "Coming soon" text. Replace with `<FuncImpMark>`, add a tagline + link to labs, add the toggle. Landing page gets full V3 texture (faint stippled corner gradient) per the density rules — no V2 data viz competes for attention here.

- [ ] **Step 1: Read the current landing page**

Run: `cat src/app/page.tsx`

- [ ] **Step 2: Replace `page.tsx`**

Write `src/app/page.tsx`:

```tsx
import Link from "next/link";

import FuncImpMark from "@/components/FuncImpMark";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 w-[360px] h-[260px] opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--color-ink) 0.6px, transparent 1px)",
          backgroundSize: "3px 3px",
          maskImage:
            "radial-gradient(ellipse at bottom right, black 0%, transparent 65%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at bottom right, black 0%, transparent 65%)",
        }}
      />

      <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-10">
        <ThemeToggle />
      </div>

      <div className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 gap-7">
        <FuncImpMark className="w-[260px] h-auto sm:w-[320px]" />
        <p className="text-[16px] opacity-85 max-w-[38ch] leading-[1.55]">
          Lab experiments by Functionally Imperative.
        </p>
        <Link
          href="/labs"
          className="font-mono text-[12px] lowercase tracking-[0.04em] px-4 py-2 border border-ink no-underline hover:bg-ink/5"
        >
          enter the labs →
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Run lint and build**

Run: `bun run lint && bun run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "refactor(landing): use FuncImpMark, add toggle, drop next/image"
```

---

### Task 8: Refactor `layout.tsx` — async server component reads the `theme` cookie

**Files:**

- Modify: `src/app/layout.tsx`

**Context:** The structural change that wires everything together. Make the root layout an `async` server component. Read the `theme` cookie via `cookies()` from `next/headers` and emit `<html data-theme={...}>` directly in SSR. Add Inter and JetBrains Mono via `next/font/google` as CSS variables that the `@theme` block already references. Drop `bg-black` from `<body>` and `data-theme="dark"` hardcoding from `<html>`. **This makes every route dynamic** (rendered per-request) instead of statically prerendered. That's expected and documented in the spec.

In Next.js 16 App Router, `cookies()` from `next/headers` returns a `Promise<ReadonlyRequestCookies>` — must be awaited. The root layout signature becomes `async function RootLayout(...)`.

- [ ] **Step 1: Read the current layout**

Run: `cat src/app/layout.tsx`

- [ ] **Step 2: Replace `layout.tsx`**

Write `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "func.lol",
  description: "Lab experiments by Functionally Imperative.",
  icons: { icon: "/func-imp-favicon.png" },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const theme: "light" | "dark" = themeCookie === "light" ? "light" : "dark";

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-paper text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Run lint, build, tests**

Run: `bun run lint && bun run build && bun test`

Expected:

- lint: clean
- build: clean, but now all routes are marked as dynamic (look for `λ` or similar dynamic indicator instead of `○` on `/`, `/labs`, `/labs/prime-moments`). **This is expected — it's the whole point of the cookie-based architecture.**
- tests: `53 pass, 0 fail`

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "refactor(layout): async server component reads theme cookie"
```

---

## Phase C — Cleanup and docs

After Phase B, every page uses the new tokens and no source file references daisyUI classes. Now drop daisyUI from `globals.css` and `package.json`, then write the durable docs.

---

### Task 9: Verify no daisyUI class references remain

**Files:**

- Read-only check.

- [ ] **Step 1: Grep for daisyUI references**

Run: `grep -rn "daisy\|btn-primary\|btn-ghost\|btn-square\|btn-sm\|card-body\|card-title\|input-bordered\|alert-warning\|link-hover\|bg-base-\|border-base-" src/`

Expected: **no matches**.

- [ ] **Step 2: Grep for bare `card` / `btn` / `input` / `alert` / `link` in className**

Run: `grep -rEn 'className="[^"]*\b(card|btn|input|alert|link)\b' src/`

Expected: **no matches**.

- [ ] **Step 3: Sanity check**

Run: `bun run lint && bun run build && bun test`
Expected: all clean, 53 tests pass.

- [ ] **Step 4: No commit** — verification only.

---

### Task 10: Drop daisyUI plugin from `globals.css`

**Files:**

- Modify: `src/app/globals.css`

- [ ] **Step 1: Edit `globals.css` and delete the plugin block**

Delete these exact lines (plus the surrounding comment):

```css
/* Keep daisyUI installed during the transition. It will be removed in
   Task 10 after every page has been refactored to not reference its
   component classes. */
@plugin "daisyui" {
  themes: dark --default;
}
```

- [ ] **Step 2: Run lint, build, tests**

Run: `bun run lint && bun run build && bun test`
Expected: clean, 53 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "chore(deps): remove daisyUI plugin from globals.css"
```

---

### Task 11: Remove `daisyui` from `package.json`

**Files:**

- Modify: `package.json`
- Auto-modified: `bun.lock`

- [ ] **Step 1: Edit `package.json`**

Delete the `"daisyui": "^5.5.19",` line from `devDependencies`. Ensure surrounding JSON stays valid — no trailing comma after the last entry.

- [ ] **Step 2: Update the lockfile**

Run: `bun install`
Expected: bun removes daisyui, no errors.

- [ ] **Step 3: Verify lockfile has no daisyUI traces**

Run: `grep -c "daisyui" bun.lock`
Expected: `0`

- [ ] **Step 4: Run lint, build, tests**

Run: `bun run lint && bun run build && bun test`
Expected: clean, 53 tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock
git commit -m "chore(deps): remove daisyui dependency"
```

---

### Task 12: Create `DESIGN.md` at the repo root

**Files:**

- Create: `DESIGN.md`

**Context:** The durable design language reference distilled from the spec. This is what future Claude sessions read before any UI work. The spec at `docs/superpowers/specs/` retains the brainstorming history; this file is the rule book.

- [ ] **Step 1: Create `DESIGN.md`**

Write `DESIGN.md`:

```markdown
# DESIGN.md

The design language for func.lol. Read this before changing any UI.

The origin story (why these rules, what was rejected, what came up
during brainstorming) lives in
[docs/superpowers/specs/2026-04-10-design-language-design.md](docs/superpowers/specs/2026-04-10-design-language-design.md).
This file is the durable rules; the spec is the history.

## Type system

Two fonts. No serifs anywhere. Loaded via `next/font/google`.

- **Inter** — everything prose or display: h1, h2, h3, body, lede.
- **JetBrains Mono** — everything data or technical chrome: inputs,
  buttons, numbers, code, breadcrumbs, metadata, labels, dates.
  Treated as the "data font," not just the "code font."

The contrast is sans vs. mono, not sans vs. serif.

### Type scale (six fixed styles)

| Use | Font | Size | Weight | Notes |
| --- | --- | --- | --- | --- |
| Display h1 | Inter | 56px from `sm` and up; 40px below | 700 | letter-spacing `-0.04em` |
| Section h2 | Inter | 28px | 700 | letter-spacing `-0.03em` |
| Subsection h3 | Inter | 18px | 600 | normal |
| Body prose | Inter | 16px | 400 | line-height 1.65 |
| Lede | Inter | 18px | 400 | opacity 0.85 |
| Mono data / inputs / code | JetBrains Mono | 13px | 400 | normal |
| Mono labels / metadata | JetBrains Mono | 10–11px UPPERCASE | 400 | letter-spacing 0.12–0.16em |

If a piece of UI doesn't fit one of these, rethink the UI rather than
add a new style.

## Color

Two colors per mode. That's the entire palette. **No accent color.**

### Light

| Token | Value | Used for |
| --- | --- | --- |
| `--paper` | `#f5f3ec` | page background |
| `--ink` | `#161616` | all text, dither, borders, button background |
| `--subtle` | `#ebe7d4` | inline `code` background only |

### Dark

| Token | Value | Used for |
| --- | --- | --- |
| `--paper` | `#0f0e0c` | page background |
| `--ink` | `#ede9d8` | all text, dither, borders, button background |
| `--subtle` | `#1c1a16` | inline `code` background only |

"Muted" is `--ink` at opacity `0.55`. There are no other ink shades.

**Naming note:** the human-readable names (`--paper`, `--ink`, `--subtle`)
are used in this document. In `globals.css` they live inside Tailwind v4's
`@theme` block with the `--color-` prefix (`--color-paper`, `--color-ink`,
`--color-subtle`). That's what generates utilities like `bg-paper` and
`text-ink`. Treat the two forms as the same token.

**No accent color anywhere.** Buttons are inverted ink-on-paper. Links
are ink with an underline. Errors are ink with a marker. The dither is
ink. The data viz is ink. The emblem is ink.

## Dither — three roles, three territories

Dithering is the visual signature of the language. Each technique has a
strict territory and a strict density rule.

### 1. Emblem (V1) — header decoration

One purposeful dithered figure per lab, in the lab page header. SVG,
~96×96 on desktop. The emblem represents **something** about the lab.
A writing-only lab may have no emblem.

### 2. Data viz (V2) — content

Used inside the article body where there's actual data to visualize.
Dither **carries meaning**. If a lab has no data to visualize, it has
no V2.

### 3. Texture (V3) — page chrome

Faint stippled gradients in page corners or as occasional separators.
Mood, not information. Lives **outside** the content area.

### Density rules

- **Pages with V2 get the lightest possible V3.** Opacity drops from
  `0.25` → `0.10`, only one corner instead of two.
- **No more than three dither elements visible on a single screen.**
  Emblem = 1, data viz = 1 (regardless of cells), each texture region = 1.
- **V3 is opt-in per page**, not site-wide. Landing generously. Lab pages
  with V2 minimally. Dense pages (lab index) skip it.
- **Dither is always rendered in `--ink`**, never in muted ink. Opacity
  fades it; color stays solid.

### Implementation

- **Emblem and texture:** SVG `<pattern>` with `<circle>` elements,
  inline in the component. No image assets.
- **Data viz:** HTML/CSS grid. Cells get classes (`prime`, `toups`) and
  a CSS `radial-gradient` paints the dotted fill.
- **No dithering library.** CSS dot patterns are good enough.

### What this rules out

- Dither as wallpaper / full-page background
- Dither inside forms or buttons
- Dither in headings (no stippled letterforms)
- Dither in any color other than `--ink`
- Multiple emblems per lab
- Decorative dithered illustrations that don't represent something

## Layout & rhythm

- **Single column.** No sidebars, ever.
- **Body prose max-width: ~60ch** (~600px at 16px Inter).
- **Page max-width: ~720px.**
- **Centered with generous padding:** 64px horizontal on desktop, 24px on mobile.
- **Vertical rhythm: multiples of 8px.** Section gaps 32–48px. Paragraph
  gaps 16px. Form row gaps 10px.
- **`hyphens: auto` on prose** (via the `prose-hyphens` utility class).

## Chrome rules (the prohibitions)

- **No card-in-card.** A card is a single rectangular surface.
- **No drop shadows. Anywhere.** Not on cards, buttons, or hover states.
- **No rounded corners.** `border-radius: 0` everywhere.
- **Hairline rules.** Section dividers are `1px solid currentColor`.
- **No hover state lifts.** Hover = small opacity bump or hairline border.
- **No gradients except dither texture itself.**

## Forms

- Inputs are bare: no border box, no background, just a single `1px` ink
  underline. Mono font.
- Labels are above the field, mono, uppercase, 10–11px, opacity `0.5`.
- Buttons are flat ink-on-paper rectangles. Mono text, lowercase.
- Secondary buttons are paper-on-ink (inverted), still flat.
- No icon buttons except the toggle and the row-delete `×`.

## Results / data display

- Mixed sans + mono. Date ranges and numbers are mono (they're data).
  Names and prose context are sans.
- Each result row is separated by a hairline rule, not a card boundary.
- Punchline numbers are bold mono, no background. Inline `code` style
  only for actual code.

## Interaction states

- **Hover:** opacity bump `0.85` → `1.0`, or background fill
  transparent → ink-at-`0.05`. No movement, no shadow.
- **Focus:** `1px solid` ink outline at `2px` offset. **Never
  `outline: none`.**
- **Active:** background fill at ink-at-`0.1`.
- **Disabled:** opacity `0.4`, `cursor: not-allowed`.

## Light/dark toggle

- **State:** cookie `theme` = `"light"` or `"dark"`. Absent = `"dark"`.
- **Mechanism:** the root layout is an `async` server component that
  reads the cookie via `cookies()` from `next/headers` and emits
  `<html data-theme={...}>` in SSR. No client script, no flash.
- **Dynamic rendering:** all routes are dynamic (rendered per-request)
  because the root layout reads cookies. Expected, not a regression.
- **Toggle component:** [src/components/ThemeToggle.tsx](src/components/ThemeToggle.tsx).
  Reads the current theme from `document.documentElement.dataset.theme`
  on mount. On click, writes the new value to the `theme` cookie AND
  the `data-theme` attribute. Subsequent navigations pick up the cookie.
- **Toggle UI:** mono character, top-right of every page. `☾` when
  currently light (= switch to dark), `☼` when currently dark (=
  switch to light). `aria-label` matches.
- **No "follow system" affordance.** First visit = dark. Clear the
  `theme` cookie in devtools to go back.

## The funcimp brand mark

Lives at [src/components/FuncImpMark.tsx](src/components/FuncImpMark.tsx).
Inline SVG using `currentColor`, so it follows whatever ink color the
surrounding theme provides automatically.

## What's NOT in this language (yet)

- MDX for lab writeups
- Per-lab Open Graph images / social cards
- Tags, categories, search across labs
- A second accent color
- Any custom icon set beyond toggle and row-delete `×`
- Photography or non-dithered illustration
- Animation beyond focus and hover states
- A second typeface family
- Per-lab custom styling
- Multi-column layouts, dashboards, dense data tables

If you want any of these, that's a new design conversation.

## Adding a new lab

1. Add an entry to the `labs` array in
   [src/app/labs/page.tsx](src/app/labs/page.tsx).
2. Create `src/app/labs/<slug>/page.tsx`. Copy the Prime Moments
   skeleton: crumb row + toggle, header row with optional emblem,
   lede, meta strip, prose, optional V2, form/interactive section
   if any, footer.
3. **What's the lab's V1 emblem?** A small dithered SVG that
   represents the lab. If nothing comes to mind in 60 seconds, skip it.
4. **Does it have V2 data viz?** Only if there's real data worth
   visualizing.
5. **Does it have V3 texture?** Only if there's no V2 — the density
   rules forbid both at full strength.

Everything else (type, color, layout, chrome, toggle) is fixed.
```

- [ ] **Step 2: Sanity check**

Run: `bun run lint && bun run build`
Expected: clean. (DESIGN.md is not code; nothing should change in lint/build behavior.)

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md
git commit -m "docs: add DESIGN.md design language reference"
```

---

### Task 13: Update `AGENTS.md` to point at `DESIGN.md`

**Files:**

- Modify: `AGENTS.md`

- [ ] **Step 1: Read the current AGENTS.md**

Run: `cat AGENTS.md`

Note the existing sections: Stack, Principles, Influences, Tooling, Contributions, Dependency policy.

- [ ] **Step 2: Insert a new "Design language" section after "Influences"**

Edit `AGENTS.md` and add this section between the "Influences" block and the "Tooling" block:

```markdown
## Design language

The visual design language is documented in [DESIGN.md](DESIGN.md) at the repo root. **Read it before any UI changes.** It covers the type system, color palette, the three roles for dithering, layout and chrome rules, the toggle, and the brand mark. The rules are intentionally restrictive — if a piece of UI doesn't fit one of the existing styles, rethink the UI rather than add a new style.

The brainstorming history that produced the language lives in [docs/superpowers/specs/2026-04-10-design-language-design.md](docs/superpowers/specs/2026-04-10-design-language-design.md).
```

- [ ] **Step 3: Verify the file parses**

Run: `cat AGENTS.md | head -40`
Expected: the new section appears in the right place, other sections intact.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): reference DESIGN.md for UI work"
```

---

### Task 14: Final end-to-end verification

**Files:**

- Read-only.

- [ ] **Step 1: Full automated check**

Run: `bun install && bun run lint && bun run build && bun test`

Expected:

- `bun install`: clean, no missing-dep warnings
- `bun run lint`: clean
- `bun run build`: clean. Build output shows `/`, `/labs`, `/labs/prime-moments` as dynamic routes (marked `λ` or equivalent), not static (`○`). This is correct and intentional — the cookie-reading root layout makes all routes dynamic.
- `bun test`: `53 pass, 0 fail`

- [ ] **Step 2: daisyUI traces**

Run: `grep -rn "daisy" src/ package.json bun.lock`
Expected: **no matches**.

Run: `grep -rEn 'className="[^"]*\b(card-body|btn-primary|btn-ghost|input-bordered|alert-warning|link-hover|bg-base-|border-base-)\b' src/`
Expected: **no matches**.

- [ ] **Step 3: Manual visual verification**

Run: `bun run dev` and open <http://localhost:3000>.

Check each page in both light and dark modes (use the toggle to switch):

1. **Landing (`/`):**
   - Cream (or near-black) background, `FUNC IMP` mark in ink color
   - Tagline below, "enter the labs →" button below that
   - Faint V3 corner texture in bottom-right
   - Toggle in top-right, click flips theme, no flash
   - Reload → no flash, theme persists

2. **Labs index (`/labs`):**
   - "← func.lol" crumb top-left, toggle top-right
   - "func imp labs" h1, small subtitle
   - Single hairline-separated entry for "Prime Moments" with date + blurb
   - Hover → subtle background fill, no movement

3. **Prime Moments lab (`/labs/prime-moments`):**
   - "← func imp labs" crumb top-left, toggle top-right
   - Big "Prime / Moments" h1 with the `[0, 30, 32]` emblem on the right
   - Lede paragraph
   - Mono meta strip ("lab 01 · 2026-04-10 · ~6 min read")
   - Two prose paragraphs
   - V2 number line: 122 cells, dotted primes, solid Toups Primes
     (11, 41, 43, 29, 59, 61, 71, 73, 101, 103)
   - More prose
   - Form with bare inputs, "+ add" / "find prime moments" buttons
   - Enter the Toups family (Lyra 2014-09-20, Sarah 1984-03-15,
     Nathan 1982-08-22), click the button
   - Results show four `[0, 30, 32]` instances with hairline separators:
     `(11, 41, 43)`, `(29, 59, 61)`, `(41, 71, 73)`, `(71, 101, 103)`
   - Footer link to the research folder

4. **Cross-page toggle behavior:**
   - Click toggle on `/`, navigate to `/labs` → theme persists, no flash
   - Click toggle on `/labs/prime-moments`, reload → theme persists, no flash
   - DevTools: `document.cookie` contains `theme=light` or `theme=dark`
   - Clear the `theme` cookie, reload → page renders dark (the default)

- [ ] **Step 4: Stop the dev server**

Press Ctrl+C to stop `bun run dev`.

Report any visual issues found. If everything looks right, the implementation is complete.

- [ ] **Step 5: No commit** — verification only.

---

## Done

After Task 14:

- daisyUI is gone from `package.json`, `bun.lock`, `globals.css`, and all source files
- Inter and JetBrains Mono are loaded via `next/font/google`
- Light/dark toggle works via cookie + SSR with zero flash
- All three pages render in the new style with their respective dither densities
- The funcimp brand mark inverts automatically with the theme
- `DESIGN.md` exists at the repo root and is referenced from `AGENTS.md`
- All 53 lib tests still pass
- All routes are dynamic (rendered per-request via the cookie-reading root layout)

Future labs follow the recipe in `DESIGN.md`'s "Adding a new lab" section.
