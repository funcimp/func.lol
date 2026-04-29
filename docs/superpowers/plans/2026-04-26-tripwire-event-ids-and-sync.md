# Tripwire stable event IDs + sync tool

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every tripwire event a stable per-request identity (cuid2) so log entries can be matched to blob files reliably, then ship a project-local tool that uses that identity to diagnose and backfill missing archive entries.

**Architecture:** Add a `req_id` field to `TripwireEvent` populated via `@paralleldrive/cuid2`'s `createId()` in `src/proxy.ts`. The same id lands in `console.log` (Vercel logs) and the blob `put` body — same source object, same value. Live writes and backfilled writes share one filename pattern: `events/<YYYY-MM-DD>/<ts-ms>-<id>.json`, where `id` is `req_id` for new events and the Vercel log id for legacy backfilled entries. A new tool at `scripts/tripwire/sync.ts` invokes the Vercel CLI to fetch logs (deduplicating the CLI's repeated entries by log id), mirrors the `events/` blob prefix locally, builds a dedup `Set` keyed on `req_id ?? logId`, and optionally backfills missing events. Watermark stored at `sync-state.json` (root) for resumable runs. `Justfile` at repo root organizes recipes; tripwire-specific scripts live under `scripts/tripwire/`.

**Tech Stack:** TypeScript / Bun for scripts. `@paralleldrive/cuid2` for IDs. Vercel CLI (`vercel logs --json`) as the log source. `@vercel/blob` for storage. `just` for command orchestration.

---

## Context

PR #11 fixed cold-start drops by wrapping `put()` in `after()`. Empirical verification using the Vercel CLI (deduplicated by log id, since the CLI returns each entry many times): 3/47 events dropped, all from 2026-04-26 (pre-PR-#11). Capture rate post-PR-#11 is ~100%. The diagnostic flow used a manual log export, file-based comparison, and `ts`-only matching.

Two weaknesses in that flow:

1. **`ts` isn't a unique key.** Two events sharing a millisecond would collide. Hashing the JSON message instead is also fragile — depends on V8 property iteration, no whitespace/escape contract from Vercel.
2. **Manual log export is friction.** The Vercel CLI can pull historical logs as JSONL with `vercel logs --json --no-follow --no-branch --environment production --since X --limit N`. No need for the dashboard export step.

Fix: a stable `req_id` per event (cuid2, generated in proxy, embedded in both log message and blob content), plus a project-local sync tool that uses CLI-fetched logs and content-based matching. Pre-existing events that lack `req_id` fall back to `ts` for matching during a one-off legacy backfill — small set (≤14 events), millisecond collision risk is acceptable, user explicitly accepted this trade.

Observability Plus retention: 30 days, max selection window 14 consecutive days. Default `--since 7d`, hard cap 14d per fetch.

Single coherent PR: live proxy gets stable IDs; tool consumes them. Branch: `feat/tripwire-event-ids-and-sync`.

## File structure

**Create:**

- `Justfile` — repo root, recipe orchestration
- `scripts/tripwire/sync.ts` — diagnose-and-backfill tool

**Modify:**

- `src/lib/tripwire/patterns.ts` — add optional `req_id` to `TripwireEvent`
- `src/proxy.ts` — import `createId`, populate `req_id` in both event objects
- `src/proxy.test.ts` — assert `req_id` present in captured `put`s
- `package.json` — add `@paralleldrive/cuid2`, update `prebuild` path, drop tripwire-aliased scripts
- `scripts/tripwire/build-bombs.ts` — moved from `scripts/build-bombs.ts`

**Delete:**

- `scripts/build-bombs.ts` (moved)
- `scripts/mirror-blob.ts` (obsoleted by sync tool)

**Side effect (one-off, not a code change):**

- After deploy: `just tripwire-sync --upload` to backfill the 3 currently-dropped events into the new `events/` prefix. The tool also fills `events/` with all logged events going forward, so post-deploy live writes plus this one backfill bring the new prefix to full coverage. The legacy `events/` prefix becomes vestigial and can be deleted later.

---

## Tasks

### Task 1: Add cuid2 dependency

**Files:**

- Modify: `package.json`, `bun.lock`

- [ ] **Step 1: Install.**

```bash
bun add @paralleldrive/cuid2
```

Expected: `package.json` gets `"@paralleldrive/cuid2": "^x.y.z"` under `dependencies`. `bun.lock` updates.

- [ ] **Step 2: Commit.**

```bash
git add package.json bun.lock
git commit -m "chore: add @paralleldrive/cuid2 for stable per-request event IDs"
```

---

### Task 2: Add `req_id` field to `TripwireEvent`

**Files:**

- Modify: `src/lib/tripwire/patterns.ts`

- [ ] **Step 1: Add the optional field.**

Edit the `TripwireEvent` interface. Add `req_id?: string` between `event` and `ts`:

```ts
export interface TripwireEvent {
  event: TripwireEventName
  req_id?: string
  ts: string
  path: string
  pattern: string
  ip: string
  query?: string
  category?: Category
  bomb?: BombKind
  ua_raw?: string
  ua_family?: string
}
```

Optional because legacy blob files (and old logs) lack the field. The `isTripwireEvent` type guard still works — it only checks `event` shape.

- [ ] **Step 2: Run patterns tests.**

```bash
bun test src/lib/tripwire/patterns.test.ts
```

Expected: all pass. Additive change.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/tripwire/patterns.ts
git commit -m "feat(tripwire): add optional req_id field to TripwireEvent"
```

---

### Task 3: Add failing test for `req_id` in proxy

TDD: assert before implementing. Test will fail because proxy doesn't yet generate `req_id`.

**Files:**

- Modify: `src/proxy.test.ts`

- [ ] **Step 1: Add `req_id` assertions.**

In the `"tripwire.hit fires-and-forgets one blob put with the event payload"` test, add:

```ts
expect(typeof event.req_id).toBe("string")
expect((event.req_id as string).length).toBeGreaterThanOrEqual(8)
```

In the `"tripwire.throttled fires-and-forgets one blob put with the smaller payload"` test, add the same.

- [ ] **Step 2: Run, expect fail.**

```bash
bun test src/proxy.test.ts
```

Expected: 2 failures (the new assertions). The `event.req_id` is `undefined` because proxy doesn't generate it yet.

---

### Task 4: Generate `req_id` in proxy

**Files:**

- Modify: `src/proxy.ts`

- [ ] **Step 1: Add the import.**

At the top of `src/proxy.ts`:

```ts
import { createId } from "@paralleldrive/cuid2"
```

- [ ] **Step 2: Populate `req_id` in `tripwire.throttled`.**

Inside the `if (!guard(ip)) { ... }` block:

```ts
const throttled: TripwireEvent = {
  event: "tripwire.throttled",
  req_id: createId(),
  ts: new Date().toISOString(),
  path: req.nextUrl.pathname,
  pattern: pattern.token,
  ip,
}
```

- [ ] **Step 3: Populate `req_id` in `tripwire.hit`.**

After the `bomb` constant, in the `hit` object literal:

```ts
const hit: TripwireEvent = {
  event: "tripwire.hit",
  req_id: createId(),
  ts: new Date().toISOString(),
  path: req.nextUrl.pathname,
  query: req.nextUrl.search,
  pattern: pattern.token,
  category: pattern.category,
  bomb,
  ua_raw: ua.slice(0, 200),
  ua_family: uaFamily(ua),
  ip,
}
```

- [ ] **Step 4: Run tests, expect green.**

```bash
bun test src/proxy.test.ts
```

Expected: all 7 pass, including the new `req_id` assertions.

- [ ] **Step 5: Run full suite + lint + build.**

```bash
bun test && bun run lint && bun run build
```

Expected: all green.

- [ ] **Step 6: Commit.**

```bash
git add src/proxy.ts src/proxy.test.ts
git commit -m "feat(tripwire): generate cuid2 req_id per event in proxy"
```

---

### Task 5: Move build-bombs to scripts/tripwire/

**Files:**

- Move: `scripts/build-bombs.ts` → `scripts/tripwire/build-bombs.ts`
- Modify: `package.json`

- [ ] **Step 1: Move the file.**

```bash
mkdir -p scripts/tripwire
git mv scripts/build-bombs.ts scripts/tripwire/build-bombs.ts
```

- [ ] **Step 2: Update package.json prebuild path.**

In `package.json`, change:

```json
"prebuild": "bun run scripts/build-bombs.ts",
"build-bombs": "bun run scripts/build-bombs.ts",
```

to:

```json
"prebuild": "bun run scripts/tripwire/build-bombs.ts",
```

(Drop the standalone `build-bombs` alias — `Justfile` will cover it.)

- [ ] **Step 3: Verify prebuild path works.**

```bash
bun run prebuild
```

Expected: bombs regenerate (or report cache hit). No errors.

- [ ] **Step 4: Commit.**

```bash
git add -A
git commit -m "chore: move build-bombs.ts under scripts/tripwire/"
```

---

### Task 6: Delete obsolete mirror-blob.ts

**Files:**

- Delete: `scripts/mirror-blob.ts`
- Modify: `package.json`

- [ ] **Step 1: Delete.**

```bash
git rm scripts/mirror-blob.ts
```

- [ ] **Step 2: Remove `mirror-blob` from `package.json` scripts.**

Drop the `"mirror-blob": "bun run scripts/mirror-blob.ts"` line.

- [ ] **Step 3: Commit.**

```bash
git add package.json
git commit -m "chore: remove mirror-blob.ts (superseded by tripwire sync tool)"
```

---

### Task 7: Add Justfile

**Files:**

- Create: `Justfile`

- [ ] **Step 1: Verify `just` is installed.**

```bash
which just || brew install just
```

- [ ] **Step 2: Write the Justfile at repo root.**

```just
# Justfile — project command orchestration.
# Run `just` (no args) for a recipe listing.

default:
    @just --list

# === Tripwire ops ===

tripwire-sync *args:
    bun run scripts/tripwire/sync.ts {{args}}

tripwire-build-bombs:
    bun run scripts/tripwire/build-bombs.ts

# === General dev ===

dev:
    bun run dev

build:
    bun run build

start:
    bun run start

# === Quality ===

lint:
    bun run lint

test:
    bun test

e2e:
    bunx playwright test

e2e-ui:
    bunx playwright test --ui
```

- [ ] **Step 3: Verify recipes load.**

```bash
just --list
```

Expected: clean recipe listing.

- [ ] **Step 4: Verify a recipe runs.**

```bash
just lint
```

Expected: lint passes.

- [ ] **Step 5: Commit.**

```bash
git add Justfile
git commit -m "chore: add Justfile for project command orchestration"
```

---

### Task 8: Implement `scripts/tripwire/sync.ts` — skeleton + flag parsing

**Files:**

- Create: `scripts/tripwire/sync.ts`

- [ ] **Step 1: Write the file with imports, types, flag parsing, and a usage error.**

Imports: `@vercel/blob` (`list`, `get`, `put`), `node:child_process` (`spawnSync`), `node:fs/promises` (`mkdir`, `writeFile`, `stat`, `readdir`, `readFile`), `node:path` (`dirname`, `join`).

Constants: `ROOT = scratch/blob`, `WATERMARK_KEY = tripwire/sync-state.json`, `MAX_DAYS = 14`, `DEFAULT_SINCE = "7d"`.

Types:
```ts
import type { TripwireEvent } from "@/lib/tripwire/patterns"

interface Flags {
  upload: boolean
  since: Date
  sinceRaw: string
  query?: string
  source: string  // default "serverless-middleware"
  limit: number   // default 5000
}
```

`parseSince(input)`: accept `7d`/`24h`/`30m` or ISO date, return Date. Cap below 14d-ago.

`parseFlags(argv)`: extract flags, fall back to defaults.

- [ ] **Step 2: Run the skeleton.**

```bash
bun run scripts/tripwire/sync.ts --help
```

Expected: clean usage message (or graceful flag handling).

- [ ] **Step 3: Commit.**

```bash
git add scripts/tripwire/sync.ts
git commit -m "feat(tripwire): sync.ts skeleton with flag parsing"
```

---

### Task 9: Implement `sync.ts` — Vercel CLI log fetch

**Files:**

- Modify: `scripts/tripwire/sync.ts`

- [ ] **Step 1: Add `fetchLogs()`.**

```ts
function fetchLogs(opts: {
  since: Date
  query?: string
  source: string
  limit: number
}): unknown[] {
  const cliArgs = [
    "logs",
    "--json",
    "--no-follow",
    "--no-branch",
    "--environment", "production",
    "--source", opts.source,
    "--since", opts.since.toISOString(),
    "--limit", String(opts.limit),
  ]
  if (opts.query) cliArgs.push("--query", opts.query)
  const result = spawnSync("vercel", cliArgs, { encoding: "utf8" })
  if (result.status !== 0) {
    throw new Error(`vercel logs failed (status=${result.status}): ${result.stderr}`)
  }
  return result.stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line))
}
```

- [ ] **Step 2: Add `extractTripwireEvents()`.**

```ts
interface LogEntry { level?: string; message?: string }

function extractTripwireEvents(logs: unknown[]): TripwireEvent[] {
  const events: TripwireEvent[] = []
  for (const raw of logs) {
    const l = raw as LogEntry
    if (l.level !== "info" || !l.message) continue
    let ev: TripwireEvent
    try { ev = JSON.parse(l.message) as TripwireEvent } catch { continue }
    if (ev.event !== "tripwire.hit" && ev.event !== "tripwire.throttled") continue
    events.push(ev)
  }
  return events
}
```

- [ ] **Step 3: Wire into main, print event count.**

In `main()`:
```ts
const logs = fetchLogs({ ... })
const events = extractTripwireEvents(logs)
console.log(`Fetched ${logs.length} log entries, ${events.length} tripwire events`)
```

- [ ] **Step 4: Run against real logs.**

```bash
bun run scripts/tripwire/sync.ts --since 7d
```

Expected: prints a count of fetched log entries and tripwire events. Should be >0 for our deployment.

- [ ] **Step 5: Commit.**

```bash
git add scripts/tripwire/sync.ts
git commit -m "feat(tripwire): sync.ts fetches logs via Vercel CLI"
```

---

### Task 10: Implement `sync.ts` — local mirror + dedup Set

**Files:**

- Modify: `scripts/tripwire/sync.ts`

- [ ] **Step 1: Add inline mirror function.**

`mirrorPrefix(prefix: string)`: paginate `list({ prefix, cursor })`, for each blob compare local size, if different `get(url, { access: "private" })` and write to `scratch/blob/<pathname>`.

- [ ] **Step 2: Add `eventKey(e)`.**

```ts
function eventKey(e: TripwireEvent): string {
  return e.req_id ?? e.ts
}
```

- [ ] **Step 3: Add `readBlobEventKeys()`.**

Walk `scratch/blob/events/<date>/*.json`, read each, parse, push `eventKey(ev)` into a `Set<string>`. Skip files that don't parse.

- [ ] **Step 4: Wire into main, print blob event count.**

```ts
await mirrorPrefix("events/")
const blobKeys = await readBlobEventKeys()
console.log(`Blob: ${blobKeys.size} unique events (by req_id ?? ts)`)
```

- [ ] **Step 5: Run.**

```bash
just tripwire-sync --since 7d
```

Expected: prints fetched logs + blob event count.

- [ ] **Step 6: Commit.**

```bash
git add scripts/tripwire/sync.ts
git commit -m "feat(tripwire): sync.ts mirrors blob locally and builds dedup Set"
```

---

### Task 11: Implement `sync.ts` — diff + missing list

**Files:**

- Modify: `scripts/tripwire/sync.ts`

- [ ] **Step 1: Compute missing.**

```ts
const missing = events.filter((ev) => !blobKeys.has(eventKey(ev)))
```

- [ ] **Step 2: Print summary.**

```ts
console.log()
console.log(`Logs (since ${flags.sinceRaw}):  ${events.length} tripwire events`)
console.log(`Blob:                              ${blobKeys.size} unique events`)
console.log(`Missing:                           ${missing.length}`)
console.log()
if (missing.length > 0) {
  console.log("--- Missing events ---")
  for (const ev of missing.sort((a, b) => a.ts.localeCompare(b.ts))) {
    const ua = ev.ua_family ?? "-"
    console.log(`  ${ev.ts}  ${ev.path.padEnd(20)}  ip=${ev.ip}  ua=${ua}`)
  }
  console.log()
  if (!flags.upload) console.log("Run again with --upload to backfill these.")
}
```

- [ ] **Step 3: Run.**

```bash
just tripwire-sync --since 7d
```

Expected: shows `N missing` with N >= 0. The known 3 cold-start drops should appear since they're still missing in blob.

- [ ] **Step 4: Commit.**

```bash
git add scripts/tripwire/sync.ts
git commit -m "feat(tripwire): sync.ts diffs logs vs blob, prints missing"
```

---

### Task 12: Implement `sync.ts` — backfill upload

**Files:**

- Modify: `scripts/tripwire/sync.ts`

- [ ] **Step 1: Add `backfillPathname()`.**

```ts
function backfillPathname(event: TripwireEvent): string {
  const date = event.ts.slice(0, 10)
  const ms = new Date(event.ts).getTime()
  const id = (event.req_id ?? event.ts).slice(0, 12)
  return `events/${date}/${ms}-bf-${id}.json`
}
```

- [ ] **Step 2: Add `uploadOne()`.**

```ts
async function uploadOne(event: TripwireEvent): Promise<string> {
  const pathname = backfillPathname(event)
  await put(pathname, JSON.stringify(event), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return pathname
}
```

- [ ] **Step 3: Wire into main when `--upload`.**

```ts
if (flags.upload && missing.length > 0) {
  let ok = 0; let fail = 0
  for (const ev of missing) {
    try {
      const pathname = await uploadOne(ev)
      console.log(`  OK    ${pathname}`)
      ok++
    } catch (err) {
      console.error(`  FAIL  ${ev.ts}: ${err instanceof Error ? err.message : String(err)}`)
      fail++
    }
  }
  console.log(`Uploaded: ${ok}, Failed: ${fail}`)
  if (fail > 0) process.exit(1)
}
```

- [ ] **Step 4: Run with --upload.**

```bash
just tripwire-sync --upload
```

Expected: 3 OK lines (or however many were missing). Listing tripwire/events shows new files.

- [ ] **Step 5: Run again, verify idempotent.**

```bash
just tripwire-sync
```

Expected: 0 missing.

- [ ] **Step 6: Commit.**

```bash
git add scripts/tripwire/sync.ts
git commit -m "feat(tripwire): sync.ts backfills missing events with --upload"
```

---

### Task 13: Implement `sync.ts` — watermark

**Files:**

- Modify: `scripts/tripwire/sync.ts`

- [ ] **Step 1: Add `readWatermark()` and `writeWatermark()`.**

Watermark stored at blob path `tripwire/sync-state.json`:

```json
{ "lastTs": "2026-04-26T22:42:25.388Z", "lastRunAt": "2026-04-27T03:15:00.000Z", "counts": { "fetched": 40, "matched": 38, "uploaded": 2 } }
```

`readWatermark()`: `list({ prefix: "tripwire/sync-state.json" })`, if found `get(url, { access: "private" })`, parse JSON, return.

`writeWatermark(ts, counts)`: `put("tripwire/sync-state.json", JSON.stringify(...), { allowOverwrite: true, ... })`.

- [ ] **Step 2: Use watermark as default `--since`.**

In flag parsing, if `--since` is not explicitly set, read watermark. If watermark exists and is < 14d ago, use it. Otherwise fall back to `7d`.

- [ ] **Step 3: Update watermark only on successful run (no upload failures, or no upload requested).**

After main work, if `flags.upload && fail === 0` (or `!flags.upload`), find max `ts` across processed events, write watermark.

- [ ] **Step 4: Run twice.**

```bash
just tripwire-sync
just tripwire-sync   # second run uses watermark
```

Expected: second run starts from watermark, fetches a much smaller window.

- [ ] **Step 5: Commit.**

```bash
git add scripts/tripwire/sync.ts
git commit -m "feat(tripwire): sync.ts persists watermark for resumable runs"
```

---

### Task 14: Open PR

**Files:**

- N/A (git operations)

- [ ] **Step 1: Push branch.**

```bash
git push -u origin feat/tripwire-event-ids-and-sync
```

- [ ] **Step 2: Open PR.**

```bash
gh pr create --title "feat(tripwire): stable event IDs (cuid2) + sync diagnose-and-backfill tool" --body "..."
```

PR body covers:
- Why: ts-only matching is fragile, manual export is friction
- What: cuid2 req_id propagated through proxy → log → blob; sync tool uses CLI to fetch logs, dedups via req_id ?? ts, optionally backfills
- Watermark for resumable runs
- File reorganization: `scripts/tripwire/`, Justfile
- One-off backfill of 3 dropped events validated with `just tripwire-sync --upload`

---

## Verification (end-to-end after deploy)

After PR merges and Vercel deploys:

1. **Confirm new events have `req_id`.**

```bash
just tripwire-sync --since 1h
# Pull a fresh log, inspect a blob file
bun -e 'import("@vercel/blob").then(async ({list, get}) => { const r = await list({prefix:"events/"}); const f = await get(r.blobs[r.blobs.length-1].url, {access:"private"}); const ev = JSON.parse(await new Response(f.stream).text()); console.log(ev) })'
```

Expected: a recent event JSON with a `req_id` field.

2. **Trigger cold-start scenario, verify it lands.**

```bash
curl -I https://func.lol/wp-login.php
# wait 10 minutes (cold-start window)
curl -I https://func.lol/.env
# wait
just tripwire-sync
```

Expected: 0 missing.

3. **Idempotent re-run.**

```bash
just tripwire-sync --upload
```

Expected: 0 missing, 0 uploaded, watermark updates `lastRunAt` only.

4. **Recovery scenario.** (Optional, only to verify partial-failure resume works.)

Manually delete a blob file, re-run sync with `--upload`, verify it gets re-uploaded with the deterministic filename.

---

## Notes

- The legacy `tripwire/events/` blob files (46 of them at design time) have no `req_id`. The migration backfills them under the new `events/` prefix with the Vercel log id as the synthetic identifier; the legacy prefix becomes vestigial and can be deleted later.
- For events captured by the live proxy after this PR deploys, `req_id` is the canonical identifier. For events captured before, the Vercel log id is the fallback. Both fit the unified filename pattern `events/<date>/<ts-ms>-<id>.json`.
- Cuid2's default length is 24 chars. Filenames are ~42 chars for live, ~55 chars for backfilled (Vercel log ids are longer). Both well under any practical limit.
- `cuid2` exports `createId` synchronously and is collision-resistant by construction; no need to verify uniqueness.
- The `vercel logs` CLI doesn't always exit cleanly with `--no-follow`; the sync tool wraps `spawnSync` with a 120s internal timeout and treats partial stdout as the data set. The `--query` server-side filter cuts the volume drastically (~50x dedup ratio reflects the CLI returning the same record many times — sync dedupes by `log.id`).
