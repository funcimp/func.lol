# Tripwire — Research

The bait paths for [the tripwire experiment](../../src/app/x/tripwire/). `robots.txt` publishes the bait list as `Disallow`. A proxy matches requests that ignore the rule and returns a contextual gzip bomb shaped like the content-type the scanner expected. This folder is the evidence that justifies every path on the list.

## The premise

Every public web server gets scanned. Not occasionally. Constantly. The traffic is dominated by a long tail of known exploit paths: `/.env`, `/wp-login.php`, `/phpunit/src/Util/PHP/eval-stdin.php`, `/actuator/env`. Scanners fire these at every IPv4 address they can route to. Hit rates on random IPs are sampled in minutes, not days. See [GreyNoise](https://www.greynoise.io/) and [Cloudflare Radar](https://radar.cloudflare.com/) writeups in [sources.md](sources.md).

## The plan

Two pieces, both consent-based:

1. `robots.txt` lists every bait path under `Disallow`. Compliant crawlers skip them. Well-behaved humans who read `robots.txt` skip them.
2. A proxy matches requests to those paths and returns a precomputed gzip bomb with `Content-Encoding: gzip`. Naive clients decompress it, blow their memory, and stop.

The trap only fires on paths that exist because scanners look for them. No legitimate visitor asks for `/wp-login.php` on a Next.js site. `robots.txt` publishes the list, so consent is explicit.

## What this folder is

- [`sources.md`](sources.md) — annotated bibliography. SecLists, nuclei-templates, OWASP CRS, CVE entries, honeypot writeups.
- [`patterns.md`](patterns.md) — the canonical bait-path list, grouped by category, every entry sourced and annotated.

## What this folder is not

No implementation code. The `proxy.ts` matcher and the `robots.txt` generator live downstream. This is the research dossier they depend on.
