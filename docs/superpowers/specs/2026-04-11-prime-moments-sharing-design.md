# Prime Moments — Sharing

**Status:** spec
**Date:** 2026-04-11
**Source:** brainstorming session (terminal + visual companion)

## Context

The Prime Moments lab ships an interactive finder: type in a group of people, get back a constellation of prime moments. The current lab is self-contained — a result lives in one browser session and disappears when you reload.

The maintainer wants a way to share a result. The concept is simple ("look at this cool pattern from my group") but the privacy surface isn't: a naïve share that includes birthdays would leak both the month+day and (via age inference) the birth year of real people. Since the repo is public and shares are likely to circulate on Substack / YouTube / social, the feature has to be designed with privacy as a load-bearing constraint, not an afterthought.

The driving insight, from the maintainer: "anyone who knows your birthday would know whether this is true or not, and if they don't, it's just interesting to know." The share is a *pattern*, not a record. The interesting thing is the constellation shape itself — the `[0, 30, 32]` offset triple, its lifetime instances, the fact that your group fits a known prime k-tuple pattern. Everything else is extraneous or identifying.

## Goal

Let a Prime Moments user share a URL that captures *just* the constellation they produced, with zero identifying information about themselves or their group. The viewer opens the URL, sees the constellation with its lifetime instances, and can optionally clear the share and try their own.

Ship this as the first Prime Moments feature beyond the core finder, and as the first shared-result primitive for the func imp labs as a whole — future labs may have their own shareable outputs, and this pattern sets the shape.

## Non-goals

Deliberately *not* in this spec, even though they came up:

- **Named shares.** The share payload never contains names, birthdays, dates, or any group-member-level data. Single rule, no opt-in, no escape hatch.
- **Current-instance indicator.** The share does not say "this group is currently at `(11, 41, 43)`" — that would leak birth year via current date. The share only names the constellation and its full lifetime instances.
- **Server-side storage.** Shares are pure client-rendered URLs with no database, no short-link service, no analytics. Everything the viewer needs to render the share is encoded in the URL itself.
- **Social preview (Open Graph) images.** Future idea, already in `IDEAS.md`. The MVP doesn't generate per-share OG images.
- **Share analytics.** Not tracking who shares what. Not necessary for a small personal site and adds privacy complexity.
- **Multi-constellation shares.** Under the admissibility filter shipped in commit `261bd56`, any single group has at most one admissible constellation. The share format assumes one constellation.
- **Editable share view.** Viewers can't modify a shared result inline. The only "write" action from a shared URL is the "try your own →" exit.
- **Shareable finder state with birthdays intact.** Hypothetical "forkable" shares that let a viewer re-run the finder with different inputs. Not now; the share is an artifact, not a save file.
- **Per-lab sharing SDK.** This spec implements sharing for Prime Moments specifically. Generalizing to a labs-wide share primitive is a later concern if a second lab needs it.

## Privacy model, stated explicitly

The share payload contains exactly this: the constellation's offset array, and nothing else. For example `[0, 30, 32]`. Everything else — the group's names, the birthdays, the date windows when moments occur, the "current" instance, the size of the group beyond what the offsets imply — is withheld at the source.

This is enforced at the encoding step: the sharer's click path only hands the offsets to the URL builder. There is no "also include X" flag, and no code path that serializes birthdays, names, or date ranges into the share URL.

A viewer of a shared URL can compute:

- The lifetime instances of the constellation (deterministic math, from the offsets alone).
- The number of lifetime instances.
- The size of the group (from the length of the offsets array).

A viewer cannot infer:

- The sharer's identity.
- Any group member's name, birthday, or current age.
- Whether the sharer's group is currently *in* a prime moment, about to be in one, or just past one.
- The sharer's relationship to the group (family, friends, team, class).

The single minor "leak" is that the constellation shape itself is derivable from the group's birth-year gaps. A viewer who happens to know the sharer's group in real life can verify "yes, that matches them." A viewer who doesn't just sees an interesting pattern. This matches the maintainer's framing and is the intended trade.

## The design language the feature lives in

All of `DESIGN.md` applies. The share button, the share view, and the emblem all use Inter + JetBrains Mono, the ink/paper token system, hairline rules, no rounded corners, no shadows, no gradients except dither. The share button is a mono flat rectangle in the same style as `+ add` and `find prime moments`. The share view uses the same page shell (crumb row, toggle, max-width container) as every other lab page.

One design-language addition: the results block grows an **actions row** at the bottom. For the MVP the row contains a single `share` button. The row is deliberately named and structured for future siblings like `add to calendar` (IDEAS.md) and any future export affordances. It is not a "share button" in the specific sense — it is an actions zone that currently has one action.

## Architecture at a glance

```text
                 ┌─────────────────────────────────────┐
                 │ /labs/prime-moments                 │
                 │                                     │
                 │ Reads cookie (theme) + query        │
                 │ ?share=<offsets> in the server      │
                 │ component.                          │
                 │                                     │
                 │ If share param is present and       │
                 │ valid → render <SharedConstellation>│
                 │ (hides <PrimeMomentsFinder>).       │
                 │                                     │
                 │ If share param is absent or invalid │
                 │ → render <PrimeMomentsFinder> as    │
                 │ today.                              │
                 └─────────────────────────────────────┘

       Normal finder path                  Share view path
       ───────────────────                  ────────────────
  ┌────────────────────────┐         ┌──────────────────────────┐
  │ PrimeMomentsFinder     │         │ SharedConstellation      │
  │ (client)               │         │ (server)                 │
  │                        │         │                          │
  │ • Form, results block  │         │ • Parses offsets          │
  │ • Actions row:         │         │ • Computes instances     │
  │   <share> button       │         │ • Renders emblem + title │
  │   writes URL to        │         │ • "Try your own →" CTA   │
  │   clipboard            │         │   links to /labs/        │
  │                        │         │   prime-moments          │
  └────────────────────────┘         └──────────────────────────┘
```

The entire feature lives inside `src/app/labs/prime-moments/`. No new routes. No server-side state. The lab page becomes a minor router-by-query-param: one branch when `?share=` is present, the current branch otherwise.

## URL shape

**Full URL:** `/labs/prime-moments?share=0,30,32`

- **Key:** `share`. Full word, not abbreviated. Readable, unambiguous, doesn't collide with any existing query key.
- **Value:** comma-separated offsets, no brackets, no spaces. Always sorted ascending, always starting with `0` (relative to the youngest member). Example: `0,30,32`, or `0,6,12,18,24`.
- **Parser:** `searchParams.get("share")?.split(",").map((s) => Number(s.trim()))`. The result is validated before use — see "Validation" below.
- **Encoder:** `offsets.join(",")`. Produces the canonical form directly.
- **Multi-constellation extension (not used in MVP):** if ever needed, separate constellations with `;`. E.g., `?share=0,30,32;0,6,12`. MVP ignores anything after the first `;`.
- **Length:** typical 3-person share is ~10 characters. The research's 13-member constellation (`0,4,6,10,16,22,24,30,34,36,46,64,66`) is ~37 characters. Well under any URL length limit.

### Validation

Before rendering the share view, the layout validates the parsed offsets and falls back to the normal finder on any failure. Specifically:

1. `searchParams.get("share")` returns a string.
2. Split on `,`, trim whitespace, convert each to a number via `Number(x)`.
3. Reject if any of the resulting values is `NaN`, negative, non-integer, or > `maxLifespan` (122).
4. Reject if the array is empty.
5. Reject if the array doesn't start with `0` (canonical form).
6. Reject if the array isn't strictly ascending.
7. Reject if the constellation isn't admissible (`isAdmissibleConstellation(offsets)` from `lib/primes.ts`).

On any rejection: ignore the share param and render the normal finder. No error toast, no redirect. The invalid URL silently falls through. This is a deliberate anti-frustration choice — if someone pastes a broken URL, they get the empty finder, not a failure page.

## Data flow

1. **Sharer:** opens `/labs/prime-moments`, enters a group, clicks `find prime moments`. The finder computes moments and displays results under the new two-line header (shipped in `261bd56`).
2. **Sharer clicks `share`:** the button handler reads the result's constellation offsets (there is exactly one admissible constellation because of the filter), constructs the URL by appending `?share=<offsets>.join(',')` to the current pathname, and writes the full URL to the clipboard via `navigator.clipboard.writeText`.
3. **Feedback:** the button's label flips to `copied ✓` for ~2 seconds, then reverts to `share`. No modal. No toast. No page navigation.
4. **Viewer opens the shared URL:** SSR reads `?share=`, parses and validates the offsets, computes the lifetime instances with `findLifetimeInstances(offsets)`, and renders the `<SharedConstellation>` component. The form does not render.
5. **Viewer clicks `try your own →`:** the CTA is a `<Link href="/labs/prime-moments">` — plain Next.js navigation to the same route with no query param. Server re-renders the normal finder.

## Components

### `SharedConstellation` (new, server component)

Path: `src/app/labs/prime-moments/SharedConstellation.tsx`.

Props: `{ offsets: number[] }` — already validated by the parent page.

Responsibilities:

- Compute the lifetime instances of the constellation using `findLifetimeInstances(offsets, maxLifespan = 122)`. This helper is new and lives in `lib/primeMoments.ts` alongside `findPrimeMoments`. It walks `p = 3, 5, ..., maxLifespan - max(offsets)` and collects every `p` where `(p, p+o1, p+o2, ...)` are all prime. Returns `number[][]` — an array of age tuples.
- Render the share view layout (see "Share view layout" below).
- Expose nothing else. No interactive state. A pure server component that takes offsets and produces HTML.

### `ConstellationEmblem` (new, standalone)

Path: `src/app/labs/prime-moments/ConstellationEmblem.tsx`.

Props: `{ offsets: number[], className?: string }`.

Responsibilities:

- Render a regular-polygon SVG emblem with `n = offsets.length` vertices placed evenly around a circle, starting at the top (angle `-π/2`).
- For `n = 1`: render a single filled circle.
- For `n = 2`: render two circles connected by a line.
- For `n ≥ 3`: render `n` circles at the vertices, lines connecting every pair, and a polygon path filled with the same stippled `<pattern>` as the existing lab-page emblem.
- Uses `currentColor` everywhere so it inherits the theme.
- Fixed viewBox `0 0 96 96`, configurable size via `className`.

This replaces nothing. The existing hand-drawn `PrimeMomentsEmblem` in `page.tsx` stays as-is — it's the lab's brand mark, stylized on purpose. `ConstellationEmblem` is a separate programmatic component used by `SharedConstellation` and callable from any future feature that needs a generic constellation visual.

### `PrimeMomentsFinder` (modify)

Path: `src/app/labs/prime-moments/PrimeMomentsFinder.tsx`.

Changes:

- Add an actions row below the result rows, rendered only when `results && totalMoments > 0`.
- The actions row is a `<div>` with mono-flat-button children. For MVP it contains one button: `<button>share</button>`.
- On click, the button builds the share URL from `results[0].offsets` (guaranteed to exist when `totalMoments > 0` under the admissibility filter), calls `navigator.clipboard.writeText(url)`, and sets a local `copied` state that flips the button label to `copied ✓` for 2 seconds via `setTimeout`.
- If `navigator.clipboard` is unavailable (non-HTTPS contexts, ancient browsers), fall back to showing an alert with the URL. Edge case only; Next.js dev + Vercel production both support the API.

### `page.tsx` (modify)

Path: `src/app/labs/prime-moments/page.tsx`.

Changes:

- The page becomes an `async` function that takes `searchParams` as a prop. In Next.js 16 App Router, dynamic `searchParams` is a `Promise<Record<string, string | string[] | undefined>>` — await it.
- Read `searchParams.share`. If present, parse + validate via a new `parseShareParam(raw: string | string[] | undefined): number[] | null` helper (lives in `lib/share.ts`, see below).
- If `parseShareParam` returns valid offsets, render `<SharedConstellation offsets={offsets} />` inside the same page shell (crumb, toggle, max-width container) and skip the prose + finder + viz blocks.
- If `parseShareParam` returns `null`, render the normal page as today.
- Reading `searchParams` makes the route dynamic, which it already is (the root layout reads cookies). No new dynamic behavior introduced.

### `lib/share.ts` (new)

Path: `src/app/labs/prime-moments/lib/share.ts`.

Pure helpers. No React. No DOM.

```ts
const MAX_LIFESPAN = 122;

export function encodeShareParam(offsets: number[]): string {
  return offsets.join(",");
}

export function parseShareParam(
  raw: string | string[] | undefined,
): number[] | null {
  if (typeof raw !== "string") return null;
  const firstConstellation = raw.split(";")[0]; // ignore anything after ;
  const parts = firstConstellation.split(",").map((s) => s.trim());
  if (parts.length === 0) return null;
  const offsets = parts.map((s) => Number(s));
  if (offsets.some((n) => !Number.isInteger(n) || n < 0 || n > MAX_LIFESPAN)) {
    return null;
  }
  if (offsets[0] !== 0) return null;
  for (let i = 1; i < offsets.length; i++) {
    if (offsets[i] <= offsets[i - 1]) return null;
  }
  // Note: admissibility check happens in the caller, after import.
  return offsets;
}
```

The caller (`page.tsx`) is responsible for the admissibility check because `parseShareParam` is pure-syntactic. Keeps the helper dependency-free.

### `lib/primeMoments.ts` (modify — small addition)

Add a new exported helper:

```ts
export function findLifetimeInstances(
  offsets: number[],
  maxLifespan: number = 122,
): number[][] {
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

This is used by `SharedConstellation` to compute what to show without needing any group input at all. Pure function, easy to test.

## Share view layout

The viewer path renders inside the same `<main>` wrapper as the normal page, preserving the crumb row, toggle, and max-width container. Below the header row the content differs completely:

```text
← func imp labs                            [☼/☾]
                                                 (crumb + toggle — unchanged)

SOMEONE SHARED A PRIME CONSTELLATION              (mono label, uppercase,
                                                   opacity 0.5, 10px)

┌───────┐
│   ▲   │   A group of 3                          (sans title, 24–28px)
│ dith. │   constellation [0, 30, 32]             (mono subtitle, 10–12px)
└───────┘

4 LIFETIME INSTANCES                              (mono label, uppercase)
(11, 41, 43) · (29, 59, 61) · (41, 71, 73) · (71, 101, 103)
                                                   (mono body, 12–13px)

[ try your own → ]                                (flat mono button,
                                                   bordered, primary style)

research → github.com/funcimp/func.lol/...        (footer, unchanged from
                                                   normal lab page)
```

Notes:

- The "someone shared a prime constellation" label makes the framing explicit. The viewer immediately knows they're looking at someone else's artifact.
- The emblem is the `ConstellationEmblem` component rendered from `offsets`. For `[0, 30, 32]` it's an equilateral triangle. For a 5-tuple it's a pentagon. Always filled with the stippled dither.
- The title says "A group of N" where N is `offsets.length`. Never "a family" (stays generic per the earlier commit).
- The instances list is a single wrapped line of `(age, age, age)` tuples separated by `·`. For a 3-member group with 4 instances, that's compact. For larger groups (e.g., 13-member with 2 instances) it still fits on 1–2 lines because each tuple is mono-short.
- `try your own →` is a `<Link href="/labs/prime-moments">` — semantically a navigation, not an action. Plain anchor styling with the flat mono button look.

## Testing

Add these to `src/app/labs/prime-moments/lib/`:

1. **`share.test.ts`** (new file). Table-driven tests for `parseShareParam`:
   - Valid cases: `"0,30,32"`, `"0"`, `"0,6,12,18,24"`, `"0, 30, 32 "` (with spaces, trimmed).
   - Invalid: `undefined`, `""`, `"not,numbers"`, `"1,30,32"` (doesn't start with 0), `"0,30,30"` (not strictly ascending), `"0,30,32;0,6"` (multi-constellation — should parse first only), `"0,-5"` (negative), `"0,200"` (over maxLifespan), `"0,3.5"` (non-integer).
   - Round-trip: `parseShareParam(encodeShareParam([0, 30, 32]))` returns `[0, 30, 32]`.

2. **`primeMoments.test.ts`** (add to existing). Tests for `findLifetimeInstances`:
   - `[0, 30, 32]` returns exactly the four known Toups Primes triples: `[[11,41,43], [29,59,61], [41,71,73], [71,101,103]]`.
   - `[0, 6, 12]` returns multiple instances (smoke test).
   - `[0, 11]` returns 1 instance `[2, 13]` if we ever check it (though the caller normally filters inadmissible patterns upstream).
   - `[0]` returns `[[3], [5], [7], ..., up to 122]` — every odd prime ≤ 122.

No component-level tests. Per `DESIGN.md`: React layer is tested by eye, lib is tested by `bun test`.

## Error handling

- **Invalid share URL:** silently fall back to the normal finder. Documented in the "Validation" section.
- **Clipboard API unavailable:** fall back to a plain `alert(url)` so the sharer can still copy manually. Warn-level logging in dev console.
- **Empty results when clicking share:** not possible — the share button only renders when `totalMoments > 0`.
- **Admissibility check fails on a shared URL:** rejected by validation, fall back to empty finder.
- **Extremely large constellation (e.g., N = 20):** allowed. The URL stays short (60+ chars), and the polygon emblem handles arbitrary N. Instances list wraps as needed.

## Critical files

### Will be created

- [src/app/labs/prime-moments/SharedConstellation.tsx](../../src/app/labs/prime-moments/SharedConstellation.tsx) — server component, renders the share view layout.
- [src/app/labs/prime-moments/ConstellationEmblem.tsx](../../src/app/labs/prime-moments/ConstellationEmblem.tsx) — programmatic polygon emblem from offsets.
- [src/app/labs/prime-moments/lib/share.ts](../../src/app/labs/prime-moments/lib/share.ts) — `parseShareParam` + `encodeShareParam`.
- [src/app/labs/prime-moments/lib/share.test.ts](../../src/app/labs/prime-moments/lib/share.test.ts) — round-trip + validation tests.

### Will be modified

- [src/app/labs/prime-moments/page.tsx](../../src/app/labs/prime-moments/page.tsx) — becomes `async`, reads `searchParams`, branches on `?share=`.
- [src/app/labs/prime-moments/PrimeMomentsFinder.tsx](../../src/app/labs/prime-moments/PrimeMomentsFinder.tsx) — adds an actions row below results with the `share` button + copy logic.
- [src/app/labs/prime-moments/lib/primeMoments.ts](../../src/app/labs/prime-moments/lib/primeMoments.ts) — adds `findLifetimeInstances` helper.
- [src/app/labs/prime-moments/lib/primeMoments.test.ts](../../src/app/labs/prime-moments/lib/primeMoments.test.ts) — adds tests for `findLifetimeInstances`.

### Unchanged

- The root layout, theme toggle, cookie plumbing, and the existing `findPrimeMoments` logic. This spec adds alongside, doesn't refactor.
- `DESIGN.md` (no rule additions). `.claude/rules/rules.md` (no rule additions). `AGENTS.md`, `IDEAS.md`, `RULES.md`.
- `research/prime-moments/`.

## Verification

1. **Lint:** `bun run lint` — clean.
2. **Build:** `bun run build` — clean. All four routes still render dynamically. The share view branch of `/labs/prime-moments` still counts as the same route.
3. **Tests:** `bun test` — 67 existing tests still pass, plus new tests for `parseShareParam`, `findLifetimeInstances`, and the admissibility-reject path for shared URLs. Target: ~80 tests passing.
4. **Manual end-to-end:**
   a. Enter REF_GROUP in the finder on a dev server.
   b. Click `share`. Verify the button flips to `copied ✓`, and paste the URL — should be `/labs/prime-moments?share=0,30,32`.
   c. Open the URL in a new tab. Verify the share view renders with the equilateral-triangle emblem, the "someone shared a prime constellation" label, the `[0, 30, 32]` subtitle, and all four Toups Primes instances listed.
   d. Click `try your own →`. Verify it navigates back to the empty finder.
   e. Paste an invalid share URL like `/labs/prime-moments?share=0,11` (inadmissible). Verify the page renders the normal finder, not the share view.
   f. Paste a syntactically broken URL like `/labs/prime-moments?share=foo`. Same fallback.
   g. Manually test with a larger group in dev (7-member or more) to verify the polygon emblem scales and the instances list wraps cleanly.
5. **Privacy audit by grep:**
   - `grep -rn "birthDate\|birthDate\|familyMember\|group\[0\].name" src/app/labs/prime-moments/SharedConstellation.tsx` — should return nothing. The share view component never references group member data.
   - `grep -rn "share=\|encodeShare" src/app/labs/prime-moments/PrimeMomentsFinder.tsx` — should show the share URL construction uses only `offsets`, never names or birthdays.

## Decisions locked in

From the brainstorming conversation:

- **Privacy:** anonymous only. No names, birthdays, dates, or current-instance leakage.
- **URL shape:** query param `?share=0,30,32` on the existing lab route. Comma-separated offsets, semicolons reserved for future multi-constellation extension (MVP uses first only).
- **Route:** same route. The lab page branches on `?share=` presence in the server component.
- **Share view:** dedicated, form hidden, emblem-forward (Option A from the brainstorm). `← func imp labs` crumb + `someone shared a prime constellation` label + emblem + title + constellation subtitle + instances + `try your own →` CTA + research footer.
- **Emblem:** programmatic regular polygon from offsets. Lab page header emblem unchanged.
- **Sharer affordance:** actions row at the bottom of the results block. Currently one action (`share`), structured for future siblings.
- **Sharer button label:** `share` (short; will sit next to siblings like `add to calendar`).
- **Click feedback:** copy to clipboard, button label flips to `copied ✓` for ~2 seconds, no modal.
- **Validation fallback:** invalid shares silently render the normal finder, never an error page.
- **Filter:** the existing admissibility filter (shipped in `261bd56`) also applies on the share-view side — inadmissible shared URLs fall through to the normal finder.
- **No server state:** no database, no short-link service, no analytics.

## Rationale, briefly

- **Why anonymous-only instead of a name-optional toggle:** simpler data model, smaller attack surface, matches the "pattern, not a record" framing. Names are the softest leak but still a leak; zero is cleaner than opt-in.
- **Why query param instead of a path segment:** same route, no new Next.js dynamic route file, SSR already reads query naturally. The URL is slightly longer but stays readable.
- **Why the actions row framing instead of a standalone share button:** `add to calendar` is already in IDEAS.md, and any future export feature wants the same spot. Baking in the row structure now avoids a second refactor.
- **Why compute lifetime instances in the share view instead of encoding them in the URL:** the instances are a deterministic function of the offsets. Encoding them would be redundant and bloat the URL. `findLifetimeInstances` is a ~10-line pure function that runs in microseconds.
- **Why silent fallback for invalid shares instead of a 404 or error toast:** pasted-broken-URL is the most common failure mode, and it's almost always a user mistake or a stale link. Dropping them into the empty finder lets them start over without a dead-end page.
- **Why programmatic polygon instead of reusing the hand-drawn emblem:** the hand-drawn triangle is specific to `[0, 30, 32]`. Shared URLs can carry any admissible shape. A regular polygon is the minimal generalization that gives every share a distinct visual without requiring per-shape art.
- **Why keep the lab page's hand-drawn emblem:** it's the lab's brand mark, stylized by hand. Consistency-for-its-own-sake doesn't justify replacing something that has intentional character.
