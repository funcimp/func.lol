# Tripwire stats page (WIP)

> **Status:** WIP. Architecture decided; visualization shapes are open and gated on a prototype-comparison phase before commit.
> **For agentic workers:** Once visualizations are picked and this doc moves out of WIP, use superpowers:subagent-driven-development or superpowers:executing-plans to implement.

**Goal:** Visualize the tripwire data on `/x/tripwire` and tell the story of why this experiment exists. Story-first writeup with inline data viz, an interactive bomb demo, and a stats panel kept fresh by a cron-refreshed JSON aggregate in Blob.

**Visual style anchor:** V2 dither (per `DESIGN.md` — V2 is reserved for data viz). Monochrome, ink-on-paper, density carries meaning.

---

## Story arc on the page

1. **Hook** — one big number ("N scanner attempts since this trap went live") + the framing: "Typically you block bad actors at the edge. I decided to have fun with them instead."
2. **Methodology** — robots.txt as consent, MIME-contextual bombs, single source of truth in `patterns.ts`. (Already in the existing writeup; this section gets compressed/repositioned.)
3. **The catch** — categories ranked, top paths ranked (top-N with expand-to-full), UA families.
4. **Interactive bomb demo** — four small bombs (one per MIME — html, json, yaml, env). Visitor clicks one, watches it inflate to a few MB of repeating text. The shareable moment.
5. **The strangers** — where scanner traffic originates, by ASN/CIDR. No raw IPs.
6. **Open data + methodology footer** — link to `patterns.ts`, link to source repo.

## Architecture (decided)

```
events/<date>/<id>.json (bronze)
        │
        ↓ (read all, aggregate, enrich IPs)
scripts/tripwire/build-stats.ts (cron-driven)
        │
        ↓
stats/tripwire-aggregates.json (blob, private)
        │
        ↓ (server component fetch, ISR revalidate=3600s)
/x/tripwire (page)
```

- **Aggregator** runs on cron (daily) via `vercel.json` `crons` entry. Mirrors `events/`, builds the JSON, writes to blob at `stats/tripwire-aggregates.json`.
- **Page** is a server component with ISR (1h cache). Fetches the aggregates blob at render time.
- **No Postgres** in v1. The aggregate JSON is the silver layer. Postgres remains the option if/when live aggregation matters.

## Aggregate JSON shape (decided)

```json
{
  "generatedAt": "2026-04-30T...",
  "lifetime": {
    "totalEvents": 86,
    "earliestTs": "2026-04-24T01:02:13.347Z",
    "daysSinceFirst": 6,
    "distinctIps": 38,
    "distinctPaths": 41,
    "distinctAsns": 14
  },
  "byCategory": [{ "category": "cms", "count": 41 }, ...],
  "byUaFamily": [{ "ua": "curl", "count": 18 }, { "ua": "unknown", "count": 31 }, ...],
  "byDay": [{ "date": "2026-04-24", "count": 8 }, ...],
  "topPaths": [
    { "path": "/wp-login.php", "count": 9, "category": "cms" },
    ...
  ],
  "byAsn": [
    { "asn": "AS14061", "name": "DigitalOcean", "count": 12 },
    { "asn": "AS24940", "name": "Hetzner Online GmbH", "count": 8 },
    ...
  ]
}
```

Shape is flat and small — easy to read in one fetch, easy to extend.

## ASN enrichment (decided)

- **Library:** `@maxmind/geoip2-node` (Node.js binding) reading `GeoLite2-ASN.mmdb`.
- **Bundling:** `.mmdb` ships in the deploy artifact (~7 MB). One-time license acceptance from MaxMind, file checked into repo (or downloaded by `prebuild` step — TBD during implementation).
- **Use:** offline IP → ASN lookup inside the aggregator. No network at run time. No API token to manage.
- **Privacy:** the page never displays raw IPs. Only aggregated counts per ASN, with the human-readable ASN name (e.g., "DigitalOcean").

## Bomb demo (decided)

Four small bombs, one per `BombKind` (`html`, `json`, `yaml`, `env`). Decompressed size capped at a few MB so a browser can inflate without dying.

- **Generation:** new prebuild step — `scripts/tripwire/build-demo-bombs.ts` writes `public/.bomb-demo.<kind>.gz`. Decompressed target ~2 MB (vs. ~2 GB for production bombs). Reuses `buildBomb()` from `src/lib/tripwire/bomb.ts`.
- **Route:** `src/app/api/tripwire/bomb-demo/[kind]/route.ts`. Same shape as the production bomb route but serves the demo files. Returns `Content-Encoding: gzip`, MIME-contextual `Content-Type`.
- **Client component:** small React component on the stats page. Four buttons (one per kind). Click → fetch the demo bomb → display inflated body in a scrollable preformatted block, capped at e.g. 100 KB rendered.
- **Why a separate route:** production bombs would crash the browser on inflate. Keeping the demo route distinct ensures we never accidentally serve a 2 GB body to a real reader.

## Visualizations (OPEN — gated on prototype phase)

We don't commit to specific viz shapes until we've prototyped and compared a few. Candidates:

**Daily activity (temporal):**
- Day strip (single row of dithered cells, count → density)
- Calendar grid (squares laid out by week)
- Sparkline (continuous line)

**Categories (categorical breakdown):**
- Horizontal bars with dithered fills
- Treemap
- Stacked-cell grid

**Top paths (long ordered list):**
- Ranked text list with inline count bars
- Two-column grid (path on left, dithered count bar on right)
- "Wall of words" (font size = count)

**ASNs / hosting providers:**
- Bar chart (top N ASNs)
- Could add geographic later; not v1

The prototype phase below is how we make these calls.

## Build plan

### Phase 0: prototype + decision

1. Aggregator skeleton that produces a complete JSON from the current bronze data. Writes to local file for prototype use.
2. Mock fixture (the JSON, committed to the repo at `src/app/x/tripwire/_fixtures/` or similar) so prototype components don't depend on live blob.
3. Prototype page at `/x/tripwire/preview` (gated behind a `TRIPWIRE_PREVIEW=1` env or just unlisted) showing several viz variants for each section side-by-side, all rendering the same fixture.
4. Manual review: pick the winners.
5. Update this plan to remove WIP status and lock in the chosen viz shapes.

### Phase 1: implementation (after prototype decisions)

6. Wire the aggregator to write to blob. Add cron entry to `vercel.json`.
7. Build the production stats panel using the chosen viz shapes. Integrate into `/x/tripwire` (or a sub-route — TBD).
8. Bomb demo: build script, `/api/tripwire/bomb-demo/[kind]` route, client component on the page.
9. ASN enrichment: bundle `GeoLite2-ASN.mmdb`, integrate `@maxmind/geoip2-node` lookup into aggregator.
10. ISR setup on the page (`revalidate = 3600`).
11. Tests: aggregator output shape, bomb-demo route headers, smoke test for the page.
12. Remove the prototype/preview route before merge (or leave behind env flag).

### Phase 2: followups (deferred)

- Postgres-backed live aggregates if blob-fetch latency or freshness becomes an issue.
- Per-IP / per-campaign view (still aggregated, no raw IP).
- Country-level geographic visualization (separate from ASN; needs GeoLite2-Country and is its own design call).

## Files (so far — will firm up during implementation)

**Create:**
- `scripts/tripwire/build-stats.ts` — aggregator
- `scripts/tripwire/build-demo-bombs.ts` — small-bomb generator
- `src/app/api/tripwire/bomb-demo/[kind]/route.ts` — demo route
- `src/app/x/tripwire/_components/*.tsx` — viz components (final shapes TBD)
- `src/app/x/tripwire/preview/page.tsx` — prototype page (during Phase 0; removed or gated for prod)

**Modify:**
- `src/app/x/tripwire/page.tsx` — integrate stats panel + bomb demo + new framing
- `vercel.json` — cron entry
- `package.json` — `@maxmind/geoip2-node` dep, prebuild for demo bombs

**Add to repo:**
- `data/GeoLite2-ASN.mmdb` (or download in prebuild — TBD)

## Open decisions (next conversation, not blocking the plan)

1. **Where does the prototype page live?** Hidden URL? `TRIPWIRE_PREVIEW` env flag? Local-only (not deployed)?
2. **GeoLite2-ASN: check into repo or download in prebuild?** The license allows redistribution with attribution. Checking in is simpler; downloading is cleaner about updating.
3. **`/x/tripwire` vs `/x/tripwire/stats`** — extend the existing writeup or split into a sub-page? Probably extend; the existing page is still fairly short.

## Verification plan (for Phase 1)

- Aggregator: produces the expected JSON shape from a known-input bronze set. Test with the fixture.
- Bomb demo: each kind serves a file under 100 KB compressed, inflates to under 4 MB. Headers include `Content-Encoding: gzip` and the right `Content-Type`.
- ASN: a known-IP fixture maps to the expected ASN name in the aggregator output.
- Page: server-side fetch of the blob succeeds; ISR cache headers present; bomb demo client component renders.
- Visual: dithered viz match the rest of the site's V2 aesthetic (manual review against `/x/prime-moments`).

---

## What's deferred to followups

- Live aggregation (Postgres silver/gold)
- Geographic country-level visualization
- Per-campaign IP analysis
- Real-time feed / "live" page
