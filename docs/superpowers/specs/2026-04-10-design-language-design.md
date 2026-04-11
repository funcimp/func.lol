# func.lol Design Language

**Status:** spec
**Date:** 2026-04-10
**Source:** brainstorming session, terminal + visual companion

## Context

`func.lol` currently has three pages:

- `/` — landing, white pixel-art `FUNC IMP` mark on black, "coming soon" line
- `/labs` — index of labs (one entry: Prime Moments)
- `/labs/prime-moments` — the first lab: writeup + interactive finder

The lab pages were built with daisyUI on top of Tailwind v4, using `card`, `card-body`, `btn`, `input`, `alert`, etc. Layout is locked to the daisyUI `dark` theme via `data-theme="dark"` on `<html>` and `bg-black` on `<body>`.

The maintainer's reaction to the current state, in their words: "I don't love the design language." Specifically:

- **Too generic / "framework default."** It looks like every other daisyUI/shadcn site — boxed cards, soft borders, neutral grays, framework-tutorial energy. Not distinctive.
- **Too much chrome.** Too many surface layers stacked on each other (card inside card inside section), too many borders, too much visual weight competing with the actual content.
- **The dark theme itself feels off.** The base-200/base-300 daisyUI grays are uninspiring, and the black background on the landing page sets an expectation the lab page doesn't honor.

The maintainer did *not* identify "wrong register / too app-y" as a problem — the writeup-with-embedded-tool framing is fine. The complaint is visual execution, not information architecture.

## Goals

1. A cohesive, distinctive design language that doesn't read as "generic framework defaults" — something a reader can recognize as "func imp."
2. Codify the language as durable rules so future labs and pages stay coherent without re-deciding from scratch.
3. Drop daisyUI as a dependency. After this work, daisyUI is not in `package.json` and not referenced in any source file.
4. Light/dark mode with manual toggle (initial state follows OS preference, override is persisted).
5. The redesigned site loads with no flash of wrong-theme content.
6. The existing `funcimp.svg` brand mark continues to work, in both modes, without two asset files to keep in sync.

## Non-goals

These are deliberately *not* part of this work, even though they came up:

- MDX for lab writeups (deferred — TSX prose is fine until prose hurts)
- Per-lab Open Graph images / social cards
- A sitemap, RSS feed, or `/feed.xml`
- Tags, categories, or search across labs
- A second accent color anywhere on the site
- Any custom icon set beyond the toggle and the row-delete `×`
- Photography or non-dithered illustration
- Animation beyond focus and hover states
- A second typeface family (serif, display, anything beyond Inter + JetBrains Mono)
- Per-lab custom styling (every lab uses the same skeleton)
- A design language *skill*. Markdown is the right shape for this; auto-triggering is unnecessary for a single-maintainer site. Skill upgrade can happen later if the workflow demands it.

## The design language

These are the rules. They're captured in full in this spec so they're recorded; the implementation will extract them into a durable `DESIGN.md` at the repo root that this spec references for future work.

### Type system

Two fonts, both via `next/font/google`. No new dependencies, no FOIT, no asset hosting.

- **Inter** — variable font. Used for everything that's prose or display: h1, h2, h3, body paragraphs, lede.
- **JetBrains Mono** — used for everything that's data or technical chrome: form inputs, buttons, numbers in results, code spans, breadcrumbs, metadata strips, labels, dates.

Treated as the "data font," not just the "code font." The contrast in the design is sans vs. mono, not sans vs. serif. **No serifs anywhere.**

Type scale (fixed and small — six total styles):

| Use | Font | Size | Weight | Notes |
| --- | --- | --- | --- | --- |
| Display h1 | Inter | 56px from `sm` (640px) and up; 40px below | 700 | letter-spacing `-0.04em` |
| Section h2 | Inter | 28px | 700 | letter-spacing `-0.03em` |
| Subsection h3 | Inter | 18px | 600 | normal letter-spacing |
| Body prose | Inter | 16px | 400 | line-height 1.65 |
| Lede (sub-heading paragraph) | Inter | 18px | 400 | opacity 0.85 |
| Mono data / inputs / code | JetBrains Mono | 13px | 400 | normal letter-spacing |
| Mono labels / metadata | JetBrains Mono | 10–11px UPPERCASE | 400 | letter-spacing `0.12–0.16em` |

If a piece of UI doesn't fit one of these, the rule is to rethink the UI rather than add a new style.

### Color

Two colors per mode. That's the entire palette. No accent color.

**Light:**

| Token | Value | Used for |
| --- | --- | --- |
| `--paper` | `#f5f3ec` | page background |
| `--ink` | `#161616` | all text, all dither, all borders, button bg |
| `--subtle` | `#ebe7d4` | inline `code` background only |

**Dark:**

| Token | Value | Used for |
| --- | --- | --- |
| `--paper` | `#0f0e0c` | page background |
| `--ink` | `#ede9d8` | all text, all dither, all borders, button bg |
| `--subtle` | `#1c1a16` | inline `code` background only |

"Muted" is `--ink` at opacity `0.55`. There are no other ink shades.

**Naming note:** the human-readable token names above (`--paper`, `--ink`, `--subtle`) are how they're referred to in this document. In `globals.css` they live inside Tailwind v4's `@theme` block and are declared with the `--color-` prefix that Tailwind requires (`--color-paper`, `--color-ink`, `--color-subtle`). That's what makes utilities like `bg-paper` and `text-ink` automatically generated. Treat the two forms as the same token.

**No accent color anywhere.** No blue links, no green success, no red error. Buttons are inverted ink-on-paper. Links are ink with an underline. Errors are ink with a marker. The dither mark is ink. The data viz is ink. The emblem is ink.

### Dither — three roles, three territories

Dithering is the visual signature of the language. To prevent it from becoming wallpaper, each technique gets a strict territory and a strict density rule.

**1. Emblem (V1) — header decoration.**
One purposeful dithered figure per lab, in the lab page header. SVG, ~96×96 on desktop, scales down on mobile. The emblem represents *something* about the lab (for Prime Moments: the `[0, 30, 32]` constellation as a stippled triangle). A future writing-only lab may have no emblem.

**2. Data viz (V2) — content.**
Used inside the article body where there's actual data to visualize. Dither *carries meaning*: dotted cells in the Prime Moments number line are the primes themselves; solid cells are the family's constellation. **If a lab has no data to visualize, it has no V2.** This is the strongest use of dithering.

**3. Texture (V3) — page chrome.**
Faint stippled gradients in page corners or as occasional section separators. Mood, not information. Lives **outside** the content area. Most likely to drift toward decoration-without-meaning, so it's the most constrained role.

**Density rules (the part that prevents noise):**

- Pages with V2 (data viz) get the lightest possible V3: opacity drops from `0.25` → `0.10`, only one corner instead of two.
- **No more than three dither elements visible on a single screen.** Counting: emblem = 1, data viz = 1 (regardless of how many cells), each texture region = 1. The Prime Moments lab page has 4 (emblem + viz + 2 corners) and is at the limit.
- Texture (V3) is opt-in per page, not site-wide. Landing page can have it generously. Lab pages with data viz minimally. Dense pages (lab index) skip it.
- Dither is always rendered in `--ink`, never in muted ink. If it's worth showing, it's worth showing crisply. Opacity is what fades it; color stays solid.

**Implementation approach:**

- Emblem and texture: SVG `<pattern>` with `<circle>` elements, inline in the component. No image assets.
- Data viz: HTML/CSS grid. The number line is `<div class="number-line">` with N cells. Each cell gets a class (`prime`, `toups`) and a CSS `radial-gradient` paints the dotted fill. No canvas, no JS beyond computing which class each cell gets. Renders identically in both modes (dither inverts with the palette automatically).
- **No dithering library.** CSS dot patterns are good enough at the sizes used; ships zero bytes of JS. If a future lab needs real dithered raster imagery, revisit then.

**What this rules out:**

- Dither as a wallpaper / full-page background
- Dither inside the form or buttons
- Dither in headings (no stippled letterforms)
- Dither in any color other than `--ink`
- Multiple emblems per lab
- Decorative dithered illustrations that don't represent something

### Layout & rhythm

- **Single column.** No sidebars, no two-column layouts, ever. Read top to bottom.
- **Body prose max-width: ~60ch** (~600px at 16px Inter). Long enough to feel substantial, short enough to read without head-turning.
- **Page max-width: ~720px.** Slightly wider than the prose so the form, viz, and results have a little room past the prose measure.
- **Centered with generous padding:** 64px horizontal on desktop, 24px on mobile.
- **Vertical rhythm: multiples of 8px.** Section gaps 32–48px. Paragraph gaps 16px. Form row gaps 10px. Implicit grid, not enforced with utility classes.
- **`hyphens: auto` on prose.** Small prose-quality detail that matters at narrow measures.

### Chrome rules (the prohibitions)

- **No card-in-card.** A card is a single rectangular surface; if you nest cards, the outer one shouldn't be a card.
- **No drop shadows. Anywhere.** Not on cards, not on buttons, not on hover states.
- **No rounded corners.** `border-radius: 0` everywhere. Sharp edges are part of the look.
- **Hairline rules.** Section dividers are `1px solid currentColor`. No double rules, no decorative dividers — except for rare V3 dithered separators where the page calls for it.
- **No hover state lifts.** Cards don't translate, don't shadow, don't scale. Hover = a small opacity bump or a hairline border accent.
- **No gradients except dither texture itself.**

### Forms

- Inputs are bare: no border box, no background, just a single `1px` ink underline. Mono font.
- Labels are above the field, mono, uppercase, 10–11px, opacity `0.5`.
- Buttons are flat ink-on-paper rectangles. Mono text, lowercase, slight letter-spacing.
- Secondary buttons are paper-on-ink (inverted), still flat, still rectangular.
- No icon buttons except the toggle and the row-delete `×`.

### Results / data display

- Mixed sans + mono. Date ranges and numbers are mono (they're data). Names and prose context are sans.
- Each result row is separated by a hairline rule, not by a card boundary.
- Numbers that are part of the punchline are bold mono, no background. Inline `code` style only for actual code.

### Interaction states

- **Hover:** opacity bump from `0.85` → `1.0`, or background fill from transparent to ink-at-0.05. No movement, no shadow.
- **Focus:** `1px solid` ink outline at `2px` offset. **No `outline: none` anywhere.**
- **Active:** background fill at ink-at-0.1.
- **Disabled:** opacity `0.4`, `cursor: not-allowed`. No greyed-out color shifts.

### Light/dark toggle

- **State:** cookie named `theme` = `"light"` or `"dark"`. Absent = `"dark"` (the default for first-time visitors regardless of OS preference).
- **No-flash mechanism:** the root layout is an `async` server component that reads the cookie via `cookies()` from `next/headers` and emits `<html data-theme="...">` directly in the SSR-rendered HTML. The page arrives with the correct theme already set; there is literally no client-side detection step and no flash window. **No inline `<script>`. No `localStorage`.**
- **Dynamic rendering:** because the root layout calls `cookies()`, every route becomes a dynamic function (rendered per-request) instead of statically prerendered. For this site the cost is negligible: traffic is low, Vercel Fluid Compute warm starts are fast, and the architecture is the standard pattern for cookie-based theming. No route-segment cache config needed for v1.
- **Token system:** CSS custom properties in `globals.css`. `@theme` declares the light values. `[data-theme="dark"]` overrides for dark. Tailwind utility classes reference the variables (e.g. `bg-paper`, `text-ink`).
- **Toggle UI:** mono icon button in the top-right of every page (in or near the breadcrumb row). A single character that shows the mode you'd be switching *to*: `☾` (moon) when the page is currently light, `☼` (sun) when the page is currently dark. 14px, ink color, no border, no background. The button has `aria-label="Switch to dark mode"` / `"Switch to light mode"` matching its current intent.
- **Toggle behavior (client):** the `<ThemeToggle>` component reads the current theme from `document.documentElement.dataset.theme` on mount (this attribute was set by the SSR'd HTML). On click, it writes the new value to the `theme` cookie via `document.cookie = "theme=light; path=/; max-age=31536000; samesite=lax"` (and analogously for dark) AND immediately updates `document.documentElement.dataset.theme` for instant visual feedback without a reload. Subsequent navigations and reloads pick up the cookie via SSR.
- **No "follow system" affordance for v1.** First-time visitors see dark; manual toggle is the only way to switch. Almost nobody will notice or care. If it ever becomes a real need, add a third tri-state value to the cookie (`light` / `dark` / `system`) and have the layout fall back to a `prefers-color-scheme` check on `system`.
- **One toggle component**, used identically on `/`, `/labs`, and `/labs/prime-moments`.

### The `funcimp` brand mark

The current `public/funcimp.svg` is already in the design language: a 1020×900 SVG with `FUNC` stacked above `IMP`, both rendered as 60×60 pixel-grid letterforms in white on a black `<rect>` ground. Pixel-art, monochrome, exactly the modern-minimal × hacker vocabulary. The only problem is hardcoded `#000000` and `#FFFFFF` fills, which prevent it from following the theme.

**Implementation:** inline the SVG as a React component (`<FuncImpMark />`), drop the background `<rect>`, replace the white fills with `currentColor`. The mark then takes whatever ink color the surrounding theme provides — black on cream in light mode, off-white on near-black in dark mode, automatically. Zero JS, no asset rewrite, ships in the initial HTML.

After this, `next/image` is no longer needed on the landing page (one less moving part). The `public/funcimp.svg` file can stay as a fallback / favicon source.

## Implementation surface

### Files created

- `DESIGN.md` at the repo root — the durable rules above, distilled into a reference document. Future Claude sessions read it before any UI work. Referenced from `AGENTS.md`.
- `src/components/FuncImpMark.tsx` — inline SVG component using `currentColor`.
- `src/components/ThemeToggle.tsx` — mono icon button, client component, reads/writes `localStorage.theme`, sets `data-theme` on `<html>`. Used identically on every page.

The shared page chrome (max-width container, breadcrumb row, optional V3 corner texture) is inlined per-page for the first pass. Two labs is not enough duplication to justify a `<PageShell>` abstraction; revisit when the third lab arrives. The `<ThemeToggle>` component, on the other hand, owns state and must be a single component from day one.

### Files modified

- `package.json` — remove `daisyui` from `devDependencies`. Confirm the `lint` and `build` scripts still pass with no other changes.
- `src/app/globals.css` — remove the `@plugin "daisyui"` block. Add `@theme` (Tailwind v4 syntax) declaring the design tokens (`--color-paper`, `--color-ink`, `--color-subtle`, `--font-sans`, `--font-mono`). Add a `[data-theme="dark"]` override block. Add hyphenation, base typography defaults.
- `src/app/layout.tsx` — drop `data-theme="dark"` and `bg-black` hardcoding. Add `next/font/google` imports for Inter and JetBrains Mono with appropriate `variable` exports. Add the inline pre-paint script in `<head>`. Apply the new font CSS variables and base text/background color via the design tokens. Update metadata if needed.
- `src/app/page.tsx` (landing) — replace the centered `next/image` block with `<FuncImpMark />` and a tagline. Place the theme toggle. Apply the new layout rules (max-width, centering, padding).
- `src/app/labs/page.tsx` — drop daisyUI classes. Hairline-separated list, mono metadata, sans titles. Place the theme toggle.
- `src/app/labs/prime-moments/page.tsx` — drop daisyUI classes. Implement the synthesis mockup as the actual page: header row with `<FuncImpMark />`-style emblem (the `[0, 30, 32]` triangle SVG, inline), lede, meta strip, prose, V2 number line viz, prose, form, results. Place the theme toggle.
- `src/app/labs/prime-moments/PrimeMomentsFinder.tsx` — drop every daisyUI class (`card`, `card-body`, `card-title`, `btn`, `btn-primary`, `btn-ghost`, `btn-square`, `btn-sm`, `input`, `input-bordered`, `alert`, `alert-warning`, `link`, `link-hover`, `bg-base-100`, `bg-base-200`, `border-base-300`). Replace with raw Tailwind utilities + the design tokens. Bare inputs, flat ink button, hairline-separated rows. Existing logic and tests are unchanged (the refactor is purely presentational).
- `AGENTS.md` — add a short pointer: "Design language rules live in `DESIGN.md`. Read it before any UI work."

### Files unchanged

- `src/app/labs/prime-moments/lib/*` — pure logic, no UI references. The 53 existing tests still pass.
- `research/prime-moments/*` — research folder is independent of the site UI.
- `IDEAS.md` — already captures future direction.
- `next.config.ts`, `tsconfig.json`, `eslint.config.mjs` — no changes expected.
- `vercel.json` — no changes.

### Files removed

- None. The `funcimp.svg` asset stays (used by the favicon and as a fallback). daisyUI is removed from `package.json` but no source file is deleted.

## Verification

1. **Dependencies:** `daisyui` no longer appears in `package.json`. `bun install` runs clean.
2. **Tests:** `bun test` — 53 tests still pass (the lib is untouched).
3. **Lint:** `bun run lint` — clean.
4. **Build:** `bun run build` — clean. All routes are now **dynamic** (rendered per-request) because the root layout reads cookies. Build output shows `λ` (or equivalent dynamic indicator) for `/`, `/labs`, and `/labs/prime-moments` instead of `○` (static). This is expected and intentional, not a regression.
5. **Source scan:** `grep -r "daisy\|btn-\|card-body\|card-title\|input-bordered\|bg-base\|border-base\|alert-\|link-hover" src/` returns nothing.
6. **Visual (dark mode, the default):**
   - `/` shows `<FuncImpMark />` in off-white on near-black, with the toggle visible.
   - `/labs` shows the hairline-separated index with mono metadata.
   - `/labs/prime-moments` shows the synthesis-mockup layout: big h1, emblem, lede, meta, prose, V2 number line, form, results.
7. **Visual (light mode, after one toggle click):**
   - All three pages render with ink-on-cream instead of cream-on-near-black. No clashing colors. The dither still reads.
8. **Toggle:**
   - First visit (no cookie): defaults to dark. Click the toggle: theme flips to light, cookie is set, no reload required.
   - Navigate to a different page: SSR reads the cookie and renders light directly. **No flash.**
   - Reload: SSR reads the cookie and renders the correct theme directly. **No flash.**
   - Clear the `theme` cookie in devtools and reload: page renders dark again.
9. **Brand mark in dark mode:** `<FuncImpMark />` is off-white on near-black, automatically.
10. **No regressions:** Toups Primes finder still computes correctly with the maintainer's family inputs; the data viz number line shows the Toups Primes pattern marked solid against the dotted primes.

## Rationale and rejected alternatives

A few decisions worth recording so future reviewers understand *why*:

- **Dropping daisyUI entirely (vs. keeping it for utilities):** daisyUI's value is its component classes. We're not using any of them after this work. Keeping it as a dep just for `data-theme` infrastructure is wasted weight; the same theming happens with raw CSS custom properties.
- **Inter + JetBrains Mono (vs. Geist, IBM Plex, Berkeley Mono):** Inter is the cleanest modern-minimal sans on Google Fonts and is well-known to next/font/google. JetBrains Mono pairs cleanly. Berkeley Mono is proprietary. Geist would also work; chose Inter because it's more conservative and there's no specific reason to optimize for the Vercel-brand association.
- **Two markdown files instead of one (DESIGN.md + spec):** the spec captures *this conversation* and ages out; DESIGN.md is the timeless rule book. Mixing them produces a doc that ages badly.
- **Markdown instead of a Claude Code skill:** for a single-maintainer public site, the auto-triggering value of a skill is marginal. Markdown is visible in PR review, public-readable, and trivially upgradeable to a skill later. See the "Non-goals" section for the longer explanation.
- **Synthesis mockup approved Round 1 (vs. iterating on multiple full-page mockups):** the maintainer responded "this is exactly what I wanted" to the first synthesis. Iterating further would have been ceremony.
- **No accent color (vs. one dim accent for links):** the synthesis mockup had zero accent and the maintainer said "I love this." Adding an accent later is easier than removing one. Started with maximum restraint deliberately.
- **Toggle as a single mono character (vs. an icon SVG):** matches the type-system rule that all UI chrome is mono. A custom icon would be a one-off that doesn't compose with the rest.
- **Inline `<FuncImpMark />` (vs. two SVG asset files):** zero asset sync, takes the theme color automatically, ships in initial HTML.
- **Cookie-based SSR theming (vs. an inline pre-paint script + localStorage):** the cookie approach renders the correct theme in the initial SSR HTML, so there is literally zero flash for any user — even better than an inline-script pattern. It also avoids the need for any inline-HTML React escape hatch in the layout. The cost is that every route becomes dynamic (rendered per-request) instead of statically prerendered, which for a low-traffic personal site on Vercel Fluid Compute is negligible. Default-to-dark instead of default-to-system trades the OS-following nicety for architectural simplicity; a tri-state cookie can be added later if it ever matters.

## What this enables (and what it doesn't)

**Enables:**

- Future labs can be built quickly: same skeleton, same type system, same chrome rules. The decision space shrinks to "what's the lab's V1 emblem and does it have a V2."
- A `/design` route someday — the language is documented enough to be its own lab.
- Eventual MDX adoption when prose hurts: the rules are layout-agnostic and would work the same in MDX.
- A real second lab with its own data viz needs.

**Doesn't enable (and would need new design work):**

- Multi-column layouts
- Dense dashboards
- Photographic content
- Games / canvas-heavy interactive labs
- Anything that needs more than two type families

These would each be a new design conversation if they ever come up.
