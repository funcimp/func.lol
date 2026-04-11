# Ideas

Rough brainstorming for func.lol — labs to build, site improvements,
writeup topics. Nothing here is a promise. When something is concrete
enough to act on, it graduates to a [GitHub issue](https://github.com/funcimp/func.lol/issues).

This file is committed to a public repository. Half-baked is fine; just
don&rsquo;t put anything here you wouldn&rsquo;t want world-readable.

## Site

- Per-lab Open Graph images / social cards
- `/feed.xml` (or `/rss.xml`) once there are 2+ labs to subscribe to
- Sitemap generation
- Re-evaluate the lab index shape when it crosses ~5 entries (tags?
  sort? grouping by topic?)
- Top-level `research/README.md` that indexes per-lab research folders
- Outbound link slots on lab pages for Substack / YouTube — add to the
  Lab type and surface them on `/labs` and `/labs/<slug>` once the first
  writeup actually lands
- Consider MDX for lab writeups when prose-in-JSX starts to hurt
  (probably lab #2 or #3, not now)
- Tests for the React layer (not just the lib) once a component bug
  proves they&rsquo;re needed

## Prime Moments

- Precompute the constellation dataset from the Go enumerator and ship
  it as a static JSON for a "browse all repeatable constellations" lab
- Calendar integration: export prime moments as `.ics` events
- Shareable links: encode the family in URL params so a result is
  forwardable
- Timeline visualization: see all prime moments laid out across a
  lifetime
- Toups chains: find cases where one constellation&rsquo;s upper values
  become another constellation&rsquo;s base
- Aggregate stats across many synthetic families
- Substack writeup explaining the math + the personal origin
- YouTube video walking through the discovery and the tool

## Future labs

(intentionally empty — add ideas as they come)
