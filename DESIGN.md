# DESIGN.md

The design language for func.lol. Read this before changing any UI.

## Type system

Two fonts. No serifs anywhere.

- **Inter** — h1, h2, h3, body, lede.
- **JetBrains Mono** — inputs, buttons, numbers, code, breadcrumbs, metadata, labels, dates. The data font, not the code font.

The contrast is sans vs. mono, not sans vs. serif.

### Type scale

| Use | Font | Size | Weight | Notes |
| --- | --- | --- | --- | --- |
| Display h1 | Inter | 56px from `sm` and up; 40px below | 700 | letter-spacing `-0.04em` |
| Section h2 | Inter | 28px | 700 | letter-spacing `-0.03em` |
| Subsection h3 | Inter | 18px | 600 | normal |
| Body prose | Inter | 16px | 400 | line-height 1.65 |
| Lede | Inter | 18px | 400 | opacity 0.85 |
| Mono data / inputs | JetBrains Mono | 13px | 400 | for standalone mono (inputs, result numbers, dates) |
| Mono labels / metadata | JetBrains Mono | 10–11px UPPERCASE | 400 | letter-spacing 0.12–0.16em |
| Inline `code` in prose | JetBrains Mono | `0.9em` | 400 | scales with parent so it stays proportional |

If a piece of UI doesn't fit one of these, rethink the UI.

## Color

Two tokens per mode. No accent color. Ever.

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

"Muted" is `--ink` at `0.55` opacity. No other ink shades.

In `globals.css` the tokens carry the `--color-` prefix (`--color-paper` etc.) that Tailwind v4's `@theme` requires to generate `bg-paper` / `text-ink` utilities. Same tokens, two forms.

## Dither

The visual signature. Three roles, strict territories, strict density.

### Three roles

- **V1 emblem** — lab header decoration. One per lab, SVG, ~96×96.
- **V2 data viz** — inside article body, where there's real data. Dither carries meaning. No data → no V2.
- **V3 texture** — page chrome outside content. Mood only.

### Density rules

- **Pages with V2 get the lightest possible V3.** Opacity `0.25` → `0.10`, one corner instead of two.
- **At most three dither elements per screen.** Emblem = 1, data viz = 1 (regardless of cells), each texture region = 1.
- **V3 is opt-in per page.** Landing generously. V2 pages minimally. Dense pages skip it.
- **Dither is always `--ink`, never muted.** Opacity fades it; color stays solid.

### Implementation

- Emblem: inline SVG with `<pattern>` + `<circle>`. No image assets.
- Data viz: HTML/CSS grid, cells tagged `prime` / `toups`, `radial-gradient` paints the dots.
- Texture: absolutely-positioned `<div>` with a CSS `radial-gradient` fill and a `mask-image` gradient to fade it into the page edge.
- No dithering library. No image assets. Everything uses `currentColor` or `var(--color-ink)` so it inverts with the theme.

### What this rules out

- Dither as wallpaper
- Dither inside forms or buttons
- Dither in headings
- Dither in any color other than `--ink`
- Multiple emblems per lab
- Decorative dither that doesn't mean something

## Layout & rhythm

- Single column. Always.
- Body prose max-width ~60ch. Page max-width ~720px.
- Centered. 64px horizontal padding desktop, 24px mobile.
- Vertical rhythm: multiples of 8px. Section gaps 32–48px, paragraph 16px, form rows 10px.
- `hyphens: auto` on prose via `.prose-hyphens`.

## Chrome — what we don't do

- No card-in-card.
- No drop shadows. Anywhere.
- No rounded corners. `border-radius: 0`.
- No hover state lifts. Hover = opacity bump or hairline border.
- No gradients except dither texture.
- Section dividers are hairline rules (`1px solid currentColor`). No doubled rules.

## Forms

- Bare inputs: `1px` ink underline, mono font, no background, no box.
- Labels above each field in single-column forms: mono, UPPERCASE, 10–11px, opacity `0.5`.
- Compact multi-column forms (e.g., name + date on one row) use a group heading + placeholder text instead, with `sr-only` labels for screen readers.
- Buttons: flat rectangles. Mono, lowercase. Primary = ink-on-paper inverted. Secondary = paper-on-ink inverted.
- No icon buttons except the toggle and row-delete `×`.

## Results / data display

- Sans for names and prose context. Mono for dates, numbers, data.
- Rows separated by hairline rules, not cards.
- Punchline numbers: bold mono, no background. Inline `code` only for real code.

## Interaction states

- **Hover.** Opacity `0.85` → `1.0`, or fill transparent → ink at `0.05`. No movement.
- **Focus.** `1px solid` ink outline, `2px` offset. Never `outline: none`.
- **Active.** Fill at ink `0.1`.
- **Disabled.** Opacity `0.4`, `cursor: not-allowed`.

## Light/dark toggle

- **State.** Cookie `theme` = `"light"` | `"dark"`. Absent = `"dark"`.
- **Mechanism.** Root layout reads the cookie via `cookies()` and emits `<html data-theme="…">` in SSR. No client script, no flash. All routes are dynamic.
- **Toggle component.** [src/components/ThemeToggle.tsx](src/components/ThemeToggle.tsx). On click, writes cookie and `data-theme`; subsequent renders pick up the cookie.
- **Glyph.** `☾` when light (click to go dark), `☼` when dark (click to go light). `aria-label` matches.
- **No "follow system".** First visit = dark. Clear the cookie to reset.

## Brand mark

[src/components/FuncImpMark.tsx](src/components/FuncImpMark.tsx). Inline SVG, `currentColor`. Follows the theme automatically.

## Not in the language (yet)

- MDX for lab writeups
- Open Graph / social cards
- Tags, categories, search
- A second accent color
- Custom icon set beyond toggle and row-delete `×`
- Photography or non-dithered illustration
- Animation beyond focus and hover
- A second typeface family
- Per-lab custom styling
- Multi-column layouts, dashboards, dense tables

## Adding a new lab

1. Add an entry to [src/app/labs/page.tsx](src/app/labs/page.tsx).
2. Create `src/app/labs/<slug>/page.tsx`. Copy the Prime Moments skeleton.
3. **V1 emblem?** A small dithered SVG that represents the lab. If nothing comes to mind in 60 seconds, skip it.
4. **V2 data viz?** Only if there's real data.
5. **V3 texture?** Only if there's no V2.

Type, color, layout, chrome, toggle — all fixed.

---

Origin story: [docs/superpowers/specs/2026-04-10-design-language-design.md](docs/superpowers/specs/2026-04-10-design-language-design.md).
