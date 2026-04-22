# Ideas

Rough brainstorming. Not promises. Concrete enough to act on → graduates to a [GitHub issue](https://github.com/funcimp/func.lol/issues).

## Site

- Per-experiment Open Graph / social cards
- RSS feed once there are 2+ experiments
- Sitemap
- Re-evaluate experiment index shape at ~5 entries (tags? sort? grouping?)
- Index `research/` with a top-level README
- Substack / YouTube link slots on experiment pages, once a writeup lands
- MDX for experiment writeups when prose-in-JSX hurts
- React component tests when a bug proves they're needed

## Tripwire

- v2: live stats panel on `/x/tripwire`. Read the daily archived JSONL files from Blob (produced by v1's cron archiver), aggregate, render. No new plumbing; v1 already writes the archive.
- v3: intelligent pattern discovery. Analyze the rest of the 404 stream for scanner-like clusters (high frequency, suspicious UA, repeated prefix). Surface candidates, a human promotes them into `patterns.ts`.
- Contextual bomb variants beyond the v1 four: YAML billion-laughs (alias bomb), ZIP/tarball bombs for `/backup.zip`-style probes, per-pattern bombs instead of per-category.
- `Accept`-header-based bomb selection for scanners that set a meaningful Accept.
- UA allowlist paired with reverse-DNS verification for known-good crawlers. The only defensible way to treat UA as signal (plain UA-string trust is a free bypass for spoofers). Add if we ever see evidence a real crawler is getting bombed.
- Distributed rate limiting via Upstash Redis, replacing the v1 per-instance in-memory guard. Graduates in when scanner traffic volume makes soft per-instance limits obviously insufficient.

## Prime Moments

- Precompute the Go enumerator output as static JSON for a "browse all constellations" experiment
- Export prime moments as `.ics` calendar events
- Shareable links: encode the family in URL params
- Timeline visualization across a lifetime
- Toups chains: one constellation's upper values become another's base
- Aggregate stats across synthetic families
- Substack writeup (math + origin story)
- YouTube walkthrough
