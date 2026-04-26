# Tripwire — Design

**Status:** spec
**Date:** 2026-04-21
**Source:** brainstorming session

## Context

Anyone who runs a publicly facing server inevitably sees scanners looking for explosed admin pages, credentials, and more. You'll see automated probes for known-vulnerable endpoints: `/.env`, `/wp-login.php`, `/phpunit/src/Util/PHP/eval-stdin.php`, `/actuator/env`, dozens of `/vendor/phpunit/...` variants, `c99.php`, `r57.php`, and hundreds more. These bots are looking for exploits and typically ignore `robots.txt`.

Inspiration: I was recently speaking with a client who had some questions of how to combat these sorts of folks. The correct answer is to use a technology such as a Web Application Firewall (WAF) with solid filtering and drop rules, but I also got to thinking about fun ways you might combat this problem (or at least attempt to mess with the folks probing the internet for exploits). I found this HN thread ([item 44670319](https://news.ycombinator.com/item?id=44670319)) about serving gzip bombs to scanners, and Ache's ["HTML Zip Bomb"](https://ache.one/notes/html_zip_bomb) note, which refines the classic trick by wrapping the bomb in a valid HTML5 document. The refinement is clever: scanners that attempt to parse the response body potentially crash twice, first on inflate, then on the parser.

The idea for func.lol: an experiment at `/x/tripwire` that makes this a consent(ish)-based trap. First, publish the bait paths in `robots.txt`. Compliant crawlers, like those from popular search engines will play nice and skip them, but the rude exploit probes? They break the tripwire and boom, they get a gzip bomb.

The research that justifies the specific bait-path list lives in [`research/tripwire/`](../../../research/tripwire/) with annotated sources and ~115 sourced tokens across eight categories.

## Goal

Ship `/x/tripwire` as the first network-facing experiment on func.lol. This site is built using next.js, so the implementation will revolve around that.

Three deliverables:

1. A `proxy.ts` that matches scanner-bait requests and returns a MIME-contextual gzip bomb.
2. A `robots.txt` that publishes every bait path under `Disallow` so compliant crawlers stay away.
3. The experiment page at `/x/tripwire` with the writeup, the methodology, the exclusions, and the references.

Do no harm to legitimate crawlers. Emit structured logs so later versions can analyze traffic without retrofitting instrumentation. Ship small, iterate like Prime Moments.

## Non-goals

Explicitly out of v1:

- **No persistence.** No database, no Redis, no Blob aggregate. Vercel request logs are the private observation deck. Stats graduate in v2.
- **No live stats on the page.** The writeup at launch does not show a counter, a feed, or a chart. The writeup is the trap plus the story.
- **No intelligent pattern discovery.** v3 idea tracked in IDEAS.md: analyze the non-tripwire 404 stream for scanner-like clusters and surface new bait candidates. Not now.
- **No additional bomb kinds.** Four MIME variants (HTML, JSON, YAML, plain/env) are enough. ZIP/tarball bombs, YAML billion-laughs alias bombs, and per-pattern bombs are v2+.
- **No third-party observability.** No Axiom, Datadog, Logtail dep. Structured logs land in Vercel's stream and stay there until v2 adds an aggregator.
- **No separate host.** Experiment ships with func.lol. Per the new `AGENTS.md` principle, experiments are self-contained.
- **No npm package.** 30 lines of routing logic is not a library; wrapping it in semver + changelog + dependency tax loses more than it earns. The artifact is the pattern people copy, not a dep they install.
- **No V1 emblem at launch.** Deferred. Prime Moments' emblem arrived later; Tripwire's will too.
- **No V2 dither data viz.** Per `DESIGN.md`, V2 only when there is real data. Persistence is v2+, so V2 data viz is v2+.
- **No UA allowlist.** Early drafts carved out bait-path requests from known-good crawler UAs (`Googlebot`, `bingbot`, etc.) on the theory that a hypothetically misbehaving real crawler deserved protection. The argument fails under inspection. Real Googlebot follows `robots.txt` and does not hit bait paths, so the allowlist protects against a scenario that does not occur. Meanwhile, scanners routinely spoof crawler UAs precisely because many servers treat them as trusted. A UA allowlist without IP verification is therefore a free bypass for spoofers, not a shield for real crawlers. The right implementation pairs UA matching with reverse-DNS verification (Google, Bing, and friends publish their crawler IP ranges), which is real work and belongs in a version where we have evidence the protection is needed. Tracked in IDEAS.md as v2+.

## Design centerpieces

Three decisions that shape everything downstream.

### 1. Consent-based framing

`robots.txt` publishes the list. Crossing the line after being told not to is consent. The bomb is the consequence. This turns "I damaged a scanner" into "I published a rule; they broke it; here is what the rule protects."

### 2. Single source of truth for patterns

One TypeScript module, `src/lib/tripwire/patterns.ts`, owns the bait list. The proxy imports it for matching. The `robots.txt` route imports it for `Disallow` emission. Adding a new pattern updates both consumers. No drift.

### 3. Contextual bombs keyed by category

Four bomb variants, each valid in its target MIME. Category maps to bomb kind. A scanner hitting `/actuator/env` (expects JSON) gets a JSON bomb. A scanner hitting `/phpmyadmin/` (expects HTML) gets an HTML bomb. A scanner hitting `/.env` (expects plain `KEY=VALUE`) gets an env-shaped bomb. The matching wrapper maximizes the damage of the decompression step by keeping the scanner's parser engaged.

## Architecture

```text
                                         consumed by
  ┌──────────────────────────────┐       ┌───────────────────┐
  │ src/lib/tripwire/patterns.ts │────▶─│ proxy.ts          │
  │                              │       │                   │
  │ - Pattern[]                  │       │ matchBait(url)    │
  │ - SAFE_PREFIXES              │       │ → serve bomb      │
  │ - categoryToBomb map         │       └───────────────────┘
  └──────────────────────────────┘
                 │                       ┌───────────────────┐
                 │                 ────▶─│ app/robots.ts     │
                 │                       │                   │
                 │                       │ emit Disallow: *  │
                 │                       └───────────────────┘
                 │
                 │ imports       ┌───────────────────┐
                 └─────────────▶ │ scripts/          │
                                 │ build-bombs.ts    │
                                 │                   │
                                 │ calls buildBomb() │
                                 │ 4x at prebuild    │
                                 │ writes public/.bomb.*.gz
                                 └───────────────────┘
```

Three modules, thin proxy, thin robots, thin build script. Each small, focused, testable.

## Pattern source of truth

**Path:** `src/lib/tripwire/patterns.ts`

**Exports:**

```ts
export type BombKind = "html" | "json" | "yaml" | "env"
export type Category =
  | "cms"
  | "framework"
  | "config"
  | "admin"
  | "actuator"
  | "cgi"
  | "metadata"
  | "webshell"
export type PatternShape = "prefix" | "substring"

export interface Pattern {
  token: string
  shape: PatternShape
  category: Category
  bomb: BombKind
}

export const PATTERNS: Pattern[] = [ /* from research/tripwire/patterns.md */ ]
export const SAFE_PREFIXES: readonly string[] = [ /* from Excluded section */ ]
```

**Pattern entries** are drawn from [`research/tripwire/patterns.md`](../../../research/tripwire/patterns.md). Each token carries its category. The category-to-bomb map lives in this same module:

```ts
export const categoryToBomb: Record<Category, BombKind> = {
  cms: "html",
  framework: "html",
  admin: "html",
  webshell: "html",
  cgi: "html",
  actuator: "json",
  metadata: "json",
  config: "env",
}
```

**Safe prefixes** (verbatim from the research "Excluded" section, applied as strict `startsWith` checks):

```
/_next/  /api/  /.well-known/  /x/  /static/  /robots.txt
/sitemap.xml  /favicon.ico  /health  /healthz  /status  /ping
```

Plus an exact-match allowlist for:

```
/  /admin  /login  /signup  /dashboard  /register
```

(These are exact-match, not prefix, because `/admin/something` might still be bait but `/admin` alone is not.)

There is no UA allowlist. See the Non-goals section for the reasoning: without reverse-DNS verification, a UA allowlist is a free bypass for spoofers rather than a shield for real crawlers, and real crawlers respect `robots.txt` so the shield is unnecessary.

## Matcher behavior

One function. `matchBait` decides whether the URL is a bait path.

```ts
export function matchBait(url: URL): Pattern | null
```

**Algorithm:**

1. Build `needle = (url.pathname + url.search).toLowerCase()`.
2. If `url.pathname` matches any `SAFE_PREFIXES` entry as a strict prefix, return `null`.
3. If `url.pathname` matches any exact-match safe path, return `null`.
4. For each `p` in `PATTERNS`:
   - `prefix` shape: match if `needle` starts with `p.token.toLowerCase()`.
   - `substring` shape: match if `needle` includes `p.token.toLowerCase()`.
   - Return the first match.
5. Return `null`.

Case-insensitive throughout. Query string is part of the haystack (ThinkPHP and Drupal exploits ride in the query string). UA is not an input: `robots.txt` does the crawler-protection work.

## Bomb builder

**Path:** `src/lib/tripwire/bomb.ts`

**API:**

```ts
export interface BuildBombOptions {
  kind: BombKind
  targetDecompressedBytes: number
  payloadText?: string  // default: "nice try "
}

export async function buildBomb(opts: BuildBombOptions): Promise<Uint8Array>
```

**Behavior:**

- Wraps the repeating payload inside the appropriate MIME skeleton.
- Streams the wrapped content through `zlib.createGzip({ level: 9 })`.
- Returns the gzipped bytes as `Uint8Array`.

**Skeletons per kind:**

| Kind | Skeleton (pseudocode) |
|---|---|
| `html` | `<!DOCTYPE html><html><head><meta charset="utf-8"><title>404</title></head><body><p>{payload repeated}</p></body></html>` |
| `json` | `{"error":"not_found","note":"{payload repeated}"}` |
| `yaml` | `warning: \|-\n  {payload repeated, indented}\n` |
| `env` | `DB_PASSWORD={payload repeated}\n` |

**Size accounting:** the target is approximate. Framing overhead (a few hundred bytes) is negligible at production size (~2 GB) and accounted for in test tolerances at small sizes.

**Why `<p>{payload}</p>` and not `<!-- {payload} -->`:** HTML comments are a byte-scan region for most parsers. They find `-->` without allocating a DOM node, which undoes ache's whole refinement (the second-order damage is the parser building allocations, not just the inflate). Text inside `<body><p>` forces a text-node allocation proportional to the decompressed size.

**Same module used by:**

- `scripts/build-bombs.ts` with `targetDecompressedBytes: 2e9` (2 GB).
- Tests with `targetDecompressedBytes: 1024` so the body can be inflated and asserted against structurally.

**Why 2 GB and not 10 GB:** the larger target burns your own bandwidth without adding meaningful damage. `"nice try "` at gzip level 9 lands somewhere between 1:200 and 1:1000 depending on how effectively deflate's 32 KB sliding window handles the 9-byte repeat. Call it a pessimistic ~10 MB compressed per 2 GB bomb. Most scanners that inflate at all OOM well before 500 MB. A 100-request probe at 10 MB per response is ~1 GB of outbound bandwidth. Vercel Pro bandwidth is ~$0.15 per GB beyond the allotment; the math stays in "buy a coffee" range even for a motivated attacker. A 10 GB target would 5–10× that without buying extra damage.

## Proxy

**Path:** `proxy.ts` (Next.js 16 uses `proxy.ts`, not `middleware.ts`). Runs on the Node.js runtime, which lets us stream bomb files directly from the local filesystem rather than same-origin `fetch`-ing them through our own CDN.

```ts
import { createReadStream } from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import type { ReadableStream as WebReadableStream } from "node:stream/web"
import { NextRequest } from "next/server"
import { matchBait, categoryToBomb, type BombKind } from "@/lib/tripwire/patterns"
import { guard, hashIP, uaFamily } from "@/lib/tripwire/observe"

const CONTENT_TYPES: Record<BombKind, string> = {
  html: "text/html; charset=utf-8",
  json: "application/json; charset=utf-8",
  yaml: "application/yaml; charset=utf-8",
  env:  "text/plain; charset=utf-8",
}

export async function proxy(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return

  const pattern = matchBait(req.nextUrl)
  if (!pattern) return

  const ua = req.headers.get("user-agent") ?? ""
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? ""
  const ipHash = hashIP(ip)

  if (!guard(ipHash)) {
    console.log(JSON.stringify({
      event: "tripwire.throttled",
      ts: new Date().toISOString(),
      path: req.nextUrl.pathname,
      pattern: pattern.token,
      ip_hash: ipHash,
    }))
    return
  }

  const bomb = categoryToBomb[pattern.category]
  const filePath = path.join(process.cwd(), "public", `.bomb.${bomb}.gz`)
  const nodeStream = createReadStream(filePath)
  const body = Readable.toWeb(nodeStream) as unknown as WebReadableStream<Uint8Array>

  console.log(JSON.stringify({
    event: "tripwire.hit",
    ts: new Date().toISOString(),
    path: req.nextUrl.pathname,
    query: req.nextUrl.search,
    pattern: pattern.token,
    category: pattern.category,
    bomb,
    ua_raw: ua.slice(0, 200),
    ua_family: uaFamily(ua),
    ip_hash: ipHash,
  }))

  return new Response(body as ReadableStream, {
    status: 200,
    headers: {
      "Content-Encoding": "gzip",
      "Content-Type": CONTENT_TYPES[bomb],
      "Cache-Control": "no-store",
    },
  })
}

// config matcher excludes /_next/, /api/, /static/ per Next.js 16 proxy
// matcher syntax. Exact syntax verified during implementation against current
// Next.js 16 docs; shape is a negative-lookahead on these prefixes.
export const config = { matcher: [ /* see implementation */ ] }
```

**Notes:**

- **Filesystem read, not `fetch`.** Reading `public/.bomb.${kind}.gz` directly via `createReadStream` is faster than a same-origin HTTP round trip and sidesteps any CDN-level interpretation of `.gz` assets (Vercel's edge might auto-decompress or normalize `Content-Encoding` on a static `.gz`; the header-lie trick depends on us being in full control of the response bytes). The exact path resolution (`public/` relative to `process.cwd()` vs a bundled non-public assets directory) is verified at implementation time against Next.js 16 file-tracing docs.
- **Status 200 matters.** Many scanners skip 404 bodies. 200 gets the body decompressed and parsed.
- **`Cache-Control: no-store`** prevents Vercel's CDN from caching the bomb response under the bait URL. Caching would flatten `tripwire.hit` logs into a single entry after the first hit.
- **`guard(ipHash)`** is the in-memory circuit breaker. See next section.

## Circuit breaker

**Path:** `src/lib/tripwire/observe.ts`

**API:**

```ts
export function guard(ipHash: string): boolean
```

Returns `true` if the request is allowed to be bombed, `false` if the breaker is open (rate limit hit).

**Behavior:**

- Per-IP limit: `MAX_PER_IP` hits per rolling 60-second window. Suggested: 30.
- Global limit: `MAX_TOTAL` hits across all IPs per rolling 60-second window. Suggested: 1000.
- Data structure: in-memory `Map<ipHash, { count: number; resetAt: number }>` plus a separate counter for the global limit, both in module scope.
- Lazy cleanup: when `guard` is called and `resetAt` is in the past, reset that entry.

**Limitations (documented, accepted):**

Fluid Compute reuses function instances but does not share memory across them. The rate limit is per-instance, not global. A determined attacker hitting many instances in parallel gets `MAX_PER_IP` per instance, not in total. For the use case ("stop my wallet from running away" and "stop accidental self-bombing during dev testing, even though dev is prod-gated"), per-instance soft limit is adequate. Proper distributed rate limiting needs Redis/Upstash, which is explicitly deferred.

**When the breaker fires:**

The proxy emits `event: "tripwire.throttled"` and returns `undefined` (pass-through). Next.js serves its default 404. No bomb bytes leave the origin.

## robots.txt

**Path:** `src/app/robots.ts` using Next.js App Router metadata API.

```ts
import type { MetadataRoute } from "next"
import { PATTERNS } from "@/lib/tripwire/patterns"

export default function robots(): MetadataRoute.Robots {
  const disallow = [...new Set(
    PATTERNS
      .filter(p => p.shape === "prefix")
      .map(p => p.token)
  )].sort()

  return {
    rules: { userAgent: "*", disallow },
    sitemap: "https://func.lol/sitemap.xml",
  }
}
```

Only `prefix`-shape patterns go into `Disallow`. `substring` tokens (e.g., `eval-stdin.php`) are meaningful to the matcher but not to `robots.txt`, which expects path prefixes. The canonical literal paths for those exploits (`/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php`, etc.) are `prefix` entries in their own right and do appear in `Disallow`.

Canonical sort so `git diff` stays clean.

## Structured logs

Two event types. All fields stable across versions.

**tripwire.hit** (bait matched, bomb served):

```json
{
  "event": "tripwire.hit",
  "ts": "2026-04-21T07:31:45.123Z",
  "path": "/phpunit/src/Util/PHP/eval-stdin.php",
  "query": "",
  "pattern": "/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php",
  "category": "framework",
  "bomb": "html",
  "ua_raw": "python-requests/2.31.0",
  "ua_family": "requests",
  "ip_hash": "sha256:a1b2c3…"
}
```

UA fields are still recorded because `ua_family` is useful for later analysis (which tools are firing the probes, what fraction spoof well-known crawler UAs, etc.). UA is observational data, not a bypass trigger.

**tripwire.throttled** (bait matched, circuit breaker fired, real 404 served):

```json
{
  "event": "tripwire.throttled",
  "ts": "2026-04-21T07:31:45.123Z",
  "path": "/phpunit/src/Util/PHP/eval-stdin.php",
  "pattern": "/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php",
  "ip_hash": "sha256:a1b2c3…"
}
```

Smaller shape because the traffic shape is what matters here, not the full request. Useful at aggregate time for understanding whether the per-IP limit is sized right.

**IP hashing:** SHA-256 of `ip + TRIPWIRE_IP_SALT`, truncated to 16 hex chars. Salt lives in the Vercel env var `TRIPWIRE_IP_SALT`. Hash happens at emit, never after. Once a raw IP reaches `console.log`, it is in Vercel's log store for seven days on Pro. No raw IPs in logs.

**UA family parsing:** tiny helper `uaFamily(ua)` that classifies common scanner UAs: `nuclei`, `nmap`, `masscan`, `zgrab`, `gobuster`, `ffuf`, `requests`, `python`, `curl`, `wget`, `Go-http-client`, plus well-known crawler families (`googlebot`, `bingbot`, etc.) so we can spot UA-spoofing scanners in the aggregated data. Fallback `"unknown"`. No full UA parsing library dep.

## Retention: log drain ingest

Vercel Pro log retention is seven days. If v2 (live stats) lands more than a week after v1 ships, the most interesting early-observation data is gone before the stats page exists. A cheap retention layer keeps raw events around without adding a page-facing feature.

**Earlier design (replaced):** A daily cron at `/api/cron/tripwire-archive` polled `https://api.vercel.com/v1/projects/<id>/logs` and merged results into a single per-day Blob file. The endpoint is undocumented (not in Vercel's REST API reference), and the archiver silently returned `incomingCount: 0` for every run despite confirmed scanner traffic. Three failure modes (auth scope, endpoint shape, response body shape) all collapsed into the same zero result, so the diagnostic shape (PR #7) could not distinguish "no traffic" from "broken plumbing." Migrated to push-based delivery.

**Current design:** Vercel Log Drain pushes NDJSON batches to `src/app/api/tripwire/drain/route.ts` whenever new logs arrive (every few seconds during traffic). The handler verifies the HMAC-SHA1 signature, parses each record, buckets by shape, and writes per-batch files to private Blob storage:

```
tripwire/events/<YYYY-MM-DD>/<unix-ms>-<rand>.jsonl.gz       tripwire.hit + tripwire.throttled
tripwire/candidates/<YYYY-MM-DD>/<unix-ms>-<rand>.jsonl.gz   non-bait 4xx responses
```

Per-batch immutable files mean no read-merge-rewrite. Date prefixes give a cheap query unit. `<rand>` is six hex chars from `randomBytes(3)` to disambiguate concurrent batches that share a millisecond.

**Routing rule per drain record:**

1. If `message` parses as a valid `TripwireEvent` (`event` is `tripwire.hit` or `tripwire.throttled`), bucket as event.
2. Else if `proxy.statusCode` is in `[400, 500)` and `proxy.path` is not in our bait list, bucket as candidate.
3. Else drop.

The `matchBait` check on candidates is defensive. Bait paths always return 200 from the bomb route, so a 4xx on a bait path should be unreachable, but the check keeps the bucket clean if the proxy ever misses one.

**Schema reference:** [Vercel Log Drains reference](https://vercel.com/docs/drains/reference/logs). Key fields used: `source`, `timestamp` (ms epoch number), `message` (stdout payload), `proxy.path`, `proxy.statusCode`, `proxy.userAgent` (array of strings), `proxy.clientIp`.

**Signature verification:** Vercel sends `x-vercel-signature` (hex SHA1 HMAC of the raw body). We verify with `crypto.createHmac("sha1", secret).update(raw).digest()` and `timingSafeEqual`. Mismatch returns 403; Vercel retries with backoff. See [Vercel Drains security](https://vercel.com/docs/drains/security).

**Environment:**

- `BLOB_READ_WRITE_TOKEN`: for writing to private Vercel Blob.
- `TRIPWIRE_DRAIN_SECRET`: shared HMAC secret. Generate with `openssl rand -hex 32`, paste into the drain config in the Vercel dashboard, and add the same value to project env vars. No `VERCEL_API_TOKEN` or `CRON_SECRET` needed.

**One-time configuration:**

1. `vercel env add TRIPWIRE_DRAIN_SECRET production` (paste the secret).
2. Vercel Dashboard → Project → Logs → Drains → Create:
   - URL: `https://func.lol/api/tripwire/drain`
   - Format: NDJSON
   - Sources: lambda, edge (the proxy and route handlers)
   - Signing secret: same value as `TRIPWIRE_DRAIN_SECRET`
   - Sampling: filter to exclude `path = /api/tripwire/drain` to avoid self-drain loops.
3. `vercel env pull .env.local`, redeploy.

**What this buys:** the drain has a documented schema (no field-name guessing), no polling window where data can be lost, and no full-access `VERCEL_API_TOKEN` required (Vercel has no fine-grained "logs read" scope). The push model also captures `candidate.4xx` records (non-bait 404 / 401 / 403 / 429) which feed v3's intelligent pattern discovery.

**What this does not do:**

- Does not surface anything on the `/x/tripwire` page at v1. Zero reader-facing consequence.
- Does not aggregate. Each batch file is raw events, gzipped. Aggregation is v2.
- Does not deduplicate. If Vercel retries on a 5xx, the same events may land in two batch files. Dedup belongs at v2 aggregation, not at ingest.

## Build-time bomb generation

**Path:** `scripts/build-bombs.ts`.

Runs as a `prebuild` hook via `package.json`, not `postinstall`. `postinstall` would run on every `bun add ...`, which is sand in the gears for a multi-file regeneration step. `prebuild` runs only when the actual artifact is being built.

```json
{
  "scripts": {
    "prebuild": "bun run scripts/build-bombs.ts",
    "build-bombs": "bun run scripts/build-bombs.ts"
  }
}
```

Runs on `next build` (locally and on Vercel CI) and on explicit `bun run build-bombs`. Writes four files to `public/`:

```
public/.bomb.html.gz
public/.bomb.json.gz
public/.bomb.yaml.gz
public/.bomb.env.gz
```

Each bomb targets ~2 GB decompressed. Compressed size is measured at build time and expected to land in low single-digit MB per file. Build cost is on the order of seconds per bomb at this target.

**Input-hash cache.** The build script hashes its deterministic inputs (`PATTERNS`, `categoryToBomb`, `payloadText`, `targetDecompressedBytes`, the skeleton per kind) and writes the hash to `public/.bomb-cache.txt`. On re-run, if the hash matches and all four bomb files exist, the script exits cleanly without regenerating. This keeps repeated builds cheap and turns the script into a no-op unless something meaningful changed.

**.gitignore** additions:

```
public/.bomb.*.gz
public/.bomb-cache.txt
```

The generator is the source of truth. The artifact is derived.

## Tests

Table-driven Bun tests throughout. File locations:

```
src/lib/tripwire/
├── patterns.ts
├── patterns.test.ts
├── bomb.ts
├── bomb.test.ts
├── observe.ts
└── observe.test.ts

src/app/robots.test.ts
proxy.test.ts
```

**`bomb.test.ts`:**

- Builds a small bomb (`targetDecompressedBytes: 1024`) for each kind.
- Inflates the result.
- Asserts the inflated body is structurally valid for its kind (HTML parses, JSON parses, YAML parses, plain text matches expected shape).
- Asserts the repeating payload text appears at least once.
- Asserts decompressed size is within target tolerance.
- Does **not** assert a compression ratio invariant at this size. At ~1 KB the gzip header dominates and any ratio floor is meaningless. The build script prints the production ratio during `bun run build-bombs` and that is the authoritative check.

**`patterns.test.ts`:**

- For every `PATTERNS` entry, at least one positive example that matches.
- For every `SAFE_PREFIXES` entry, a path under that prefix that returns `null`.
- Case-insensitivity: `/phpMyAdmin/` and `/phpmyadmin/` both match the same pattern.
- Query-string matching: `/index.php?s=/Index/\think\app/invokefunction` matches the ThinkPHP substring pattern.
- UA irrelevance: a request with `User-Agent: Googlebot/2.1` hitting `/wp-admin/` returns a `Pattern` (no UA-based carve-out).
- No `PATTERNS` entry produces a match for any path under any `SAFE_PREFIXES` entry (sanity property).

**`robots.test.ts`:**

- Every `prefix`-shape pattern in `PATTERNS` appears in the generated `Disallow` list.
- No `substring`-shape pattern's bare token appears in the generated list.
- No excluded path appears in the list.
- Entries are sorted and deduplicated.

**`observe.test.ts`:**

- `hashIP` returns a stable hash for a given IP + salt.
- `hashIP` returns a different hash for different IPs.
- `hashIP` of empty string returns a stable value.
- `uaFamily` classifies known scanner UAs to the expected family, unknown UAs to `"unknown"`.
- `guard`: first N calls with a given `ipHash` return `true`; the (N+1)th returns `false`; after the 60 s window elapses, the next call returns `true` again.
- `guard` respects the global limit: once M calls have been made across all IPs within the window, any further IP returns `false`.

**`proxy.test.ts`:**

- Direct call with a bait URL (with `NODE_ENV=production`) returns a `Response` with `Content-Encoding: gzip` and the right `Content-Type` per bomb kind.
- Non-bait URLs return `undefined` (pass-through).
- `NODE_ENV !== "production"` returns `undefined` even on a bait URL (prod-gate sanity check).
- Circuit breaker: after `MAX_PER_IP` bait hits from a single `ip_hash`, the next call returns `undefined` and emits `tripwire.throttled`.
- No body decompression (the response body is not inflated in this test; assertions are on headers and first bytes being gzip magic `0x1f 0x8b`). Small-bomb fixtures are used, generated in-memory via `buildBomb` rather than read from disk, so the test does not depend on `prebuild` having run.

**No Playwright on bait paths.** Playwright inflates response bodies. Decompressing a production bomb crashes the runner.

## Page

**Path:** `src/app/x/tripwire/page.tsx`.

Page shell follows `DESIGN.md`: crumb row with back link and theme toggle, max-width 720 px container, single column. Title `tripwire`. Subtitle in muted mono: `robots.txt publishes the rules. ignoring them trips the wire.`

Sections:

1. **Lede.** The FastAPI-log observation from the brainstorming session, reframed for the writeup: every public server gets scanned, here is what it looks like, here is what we do about it.
2. **The trap.** The consent-based framing. `robots.txt` as the rule, the bomb as the consequence.
3. **The bomb.** The HTML-zipbomb refinement (ache.one credit). Four MIME kinds. The header lie (`Content-Encoding: gzip`).
4. **The matcher.** The pattern list as single source of truth. Safe-path allowlist. No UA allowlist, and why. Also note the asymmetry: some patterns are substring tokens (e.g., `eval-stdin.php`) that cannot appear in `robots.txt` because `robots.txt` only speaks in path prefixes. The canonical prefix forms for the same exploits (e.g., `/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php`) do appear. A scanner that hits a substring-only match has still hit a token that is definitionally a scanner signature, so the consent framing still stands, just not as cleanly as for prefix matches.
5. **Why not a UA allowlist.** Explain the reasoning from the Non-goals section: without reverse-DNS verification, a UA allowlist lets spoofers through while doing nothing useful for real crawlers (who already respect `robots.txt`). Note the v2+ path (paired UA + reverse-DNS) and why we are not paying for it yet.
6. **Code.** Small inline listings of the proxy, the bomb builder signature, the `robots.ts`. Readers should be able to copy the pattern without installing anything.
7. **Exclusions.** Why bare `/admin`, `/api`, `/.well-known/`, etc. are never bait on a Next.js site.
8. **References.** Links to `research/tripwire/sources.md`, the HN thread, the ache.one article, key CVEs.
9. **What is next.** v2 (live stats via log aggregation) and v3 (intelligent pattern discovery) briefly named with pointers to IDEAS.md.

**Dither treatment:** V3 corner texture, `--ink`, opacity `0.10` to `0.25`, one corner. No V2. No V1 emblem at launch. Single column, hairline rules between sections.

## Safety notes

- **Self-bombing.** The proxy is active only in production. The top of `proxy()` checks `process.env.NODE_ENV === "production"` and returns early otherwise. Local `bun dev` does not serve bombs. The bait matcher, bomb builder, and `robots.txt` route are still fully testable locally through unit tests that call the functions directly with fabricated `NextRequest` objects. No dev-server exposure, full coverage.
- **Route-collision rule** (new entry in `AGENTS.md` at implementation time): no func.lol route uses any path that matches a bait pattern in `patterns.ts`. The `patterns.ts` module is the authoritative list. If a future page wants a forbidden path, remove the pattern first.
- **Legal posture.** The bytes we serve are real HTTP bytes with truthful `Content-Encoding`. Decompression is the client's own behavior. No unauthorized access. Scanner operators already accept the risk of parsing hostile responses; they fire billions of probes daily. This is a passive trap, not an attack.

## Files this touches

New:

- `proxy.ts`
- `src/lib/tripwire/patterns.ts`
- `src/lib/tripwire/bomb.ts`
- `src/lib/tripwire/observe.ts`
- `src/lib/tripwire/patterns.test.ts`
- `src/lib/tripwire/bomb.test.ts`
- `src/lib/tripwire/observe.test.ts`
- `src/app/robots.ts`
- `src/app/robots.test.ts`
- `src/app/api/tripwire/drain/route.ts`
- `src/app/api/tripwire/drain/route.test.ts`
- `src/app/x/tripwire/page.tsx`
- `scripts/build-bombs.ts`
- `proxy.test.ts`

Edited:

- `package.json`: add `prebuild` and `build-bombs` scripts.
- `.gitignore`: add `public/.bomb.*.gz` and `public/.bomb-cache.txt`.
- `.env.local` and Vercel env: add `BLOB_READ_WRITE_TOKEN` and `TRIPWIRE_DRAIN_SECRET`. The drain itself is configured in the Vercel dashboard. Earlier drafts also set `TRIPWIRE_IP_SALT` (removed when we decided to store raw scanner IPs for ASN/BGP analysis), `VERCEL_API_TOKEN`, and `CRON_SECRET` (both removed when the cron archiver was replaced with the drain).
- `src/app/x/page.tsx`: add the Tripwire entry to the experiments index.
- `AGENTS.md`: add the route-collision rule.

## v2 / v3 followups

Tracked in [`IDEAS.md`](../../../IDEAS.md) under the `Tripwire` section:

- **v2.** Live stats panel on `/x/tripwire`. Read per-batch JSONL files from `tripwire/events/` and `tripwire/candidates/` in Blob (produced by the drain ingest endpoint), aggregate, render stats. No new storage plumbing; the drain built it.
- **v3.** Intelligent pattern discovery. Analyze the non-tripwire 404 stream for scanner-like clusters and surface new bait candidates.
- Contextual bomb variants beyond the four (YAML billion-laughs alias bomb, ZIP/tarball bombs, per-pattern bombs).
- `Accept`-header-driven bomb selection.
- UA allowlist paired with reverse-DNS verification for known-good crawlers.
- Distributed rate limiting via Upstash Redis, replacing the per-instance in-memory guard.

## References

- Research dossier: [`research/tripwire/`](../../../research/tripwire/)
  - [`README.md`](../../../research/tripwire/README.md)
  - [`sources.md`](../../../research/tripwire/sources.md)
  - [`patterns.md`](../../../research/tripwire/patterns.md)
- HN thread (inspiration): <https://news.ycombinator.com/item?id=44670319>
- Ache, "HTML Zip Bomb": <https://ache.one/notes/html_zip_bomb>
- SecLists (Daniel Miessler): <https://github.com/danielmiessler/SecLists>
- nuclei-templates (ProjectDiscovery): <https://github.com/projectdiscovery/nuclei-templates>
- OWASP CRS: <https://github.com/coreruleset/coreruleset>
- Next.js App Router `robots` metadata API: <https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots>
- Next.js 16 `proxy.ts` reference (replaces `middleware.ts`).
