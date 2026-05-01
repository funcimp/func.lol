// src/app/x/tripwire/page.tsx
import type { Metadata } from "next"
import Link from "next/link"

import ThemeToggle from "@/components/ThemeToggle"
import { getAggregates } from "@/lib/tripwire/aggregates"
import { BombDemo } from "./_components/BombDemo"
import { Hero, StatsPanel } from "./_components/StatsPanel"

export const metadata: Metadata = {
  title: "Tripwire — func.lol",
  description:
    "A consent-based trap for automated scanners. robots.txt publishes the rules. Ignoring them trips the wire.",
}

// ISR: the stats blob is refreshed by the hourly cron at
// /api/cron/tripwire-stats. 30-minute revalidate gives stale-while-
// revalidate semantics — high-traffic pages re-render against the
// freshest blob in the background; low-traffic pages still see fresh
// data thanks to the cron.
export const revalidate = 1800

export default async function TripwirePage() {
  const aggregates = await getAggregates()
  return (
    <main className="min-h-screen px-6 py-12 sm:px-16 sm:py-16">
      <div className="mx-auto max-w-[720px]">
        <div className="flex items-center justify-between mb-7">
          <Link
            href="/x"
            className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-55 hover:opacity-100 no-underline"
          >
            ← experiments
          </Link>
          <ThemeToggle />
        </div>

        <header className="mb-9">
          <h1 className="text-[40px] sm:text-[56px] font-bold leading-[0.95] tracking-[-0.04em]">
            tripwire
          </h1>
          <p className="font-mono text-[13px] opacity-55 mt-3">
            robots.txt publishes the rules. ignoring them trips the wire.
          </p>
        </header>

        <Hero lifetime={aggregates.lifetime} />

        <article className="prose-hyphens text-[16px] leading-[1.65]">
          <section className="mb-9">
            <p>
              Every public web server gets scanned. Not occasionally. Constantly.
              The traffic is dominated by automated probes for known-vulnerable
              endpoints: <code>/.env</code>, <code>/wp-login.php</code>,{" "}
              <code>/phpunit/src/Util/PHP/eval-stdin.php</code>,{" "}
              <code>/actuator/env</code>, and hundreds more. The scanners fire
              at every IPv4 address they can route to, they ignore{" "}
              <code>robots.txt</code>, and they do not care about 404s. The
              numbers above are this site&rsquo;s slice of that traffic.
            </p>
          </section>

          <section className="mb-9">
            <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">The trap</h2>
            <p>
              Tripwire is a consent-based trap. The bait paths are published in{" "}
              <code>robots.txt</code> under <code>Disallow</code>. Compliant
              crawlers respect the rule and stay away. Anyone who shows up
              anyway has identified themselves as a scanner by breaking a rule
              they were given. The consequence is a gzip bomb. Their resources
              burn. Ours do not.
            </p>
          </section>

          <section className="mb-9">
            <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">The bomb</h2>
            <p>
              The bomb is a precompressed file served with{" "}
              <code>Content-Encoding: gzip</code>. The client&rsquo;s HTTP library
              decompresses it transparently into memory, which is where the
              damage happens. We ship four variants. Each is shaped like the
              MIME type the scanner expected: HTML for admin panels and CMS
              endpoints, JSON for REST probes and Spring actuator paths, YAML
              for config-file probes, plain text for leaked-credential probes.
              The point is to keep the scanner&rsquo;s parser engaged after the
              inflate, not just the network stack. Credit to{" "}
              <a
                className="underline"
                href="https://ache.one/notes/html_zip_bomb"
                target="_blank"
                rel="noreferrer"
              >
                Ache&rsquo;s HTML Zip Bomb
              </a>{" "}
              for refining the HTML variant. The production bombs inflate to
              ~2 GB. The buttons below serve a 2 MB version so a real reader
              can sample the trick without their tab dying.
            </p>
          </section>
        </article>

        <section className="mb-12">
          <BombDemo />
        </section>

        <section className="mb-12">
          <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-6">What we caught</h2>
          <StatsPanel aggregates={aggregates} />
        </section>

        <article className="prose-hyphens text-[16px] leading-[1.65]">
          <section className="mb-9">
            <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">The matcher</h2>
            <p>
              One TypeScript module owns the bait list. The proxy imports it for
              matching. The <code>robots.txt</code> route imports it for{" "}
              <code>Disallow</code> emission. No drift. There is no UA
              allowlist: without reverse-DNS verification, trusting UA is a free
              bypass for spoofers rather than a shield for real crawlers, and
              real crawlers already respect <code>robots.txt</code>. An
              in-memory rate limit bounds how much bandwidth a single attacker
              can extract from this site, falling through to a normal 404 once
              the breaker trips.
            </p>
            <p className="mt-4">
              A safe-path allowlist protects legitimate routes. Anything under{" "}
              <code>/_next/</code>, <code>/api/</code>, <code>/x/</code>,{" "}
              <code>/.well-known/</code>, <code>/static/</code>, and common
              health-check names never matches. Generic paths like{" "}
              <code>/admin</code>, <code>/login</code>, <code>/dashboard</code>{" "}
              are excluded too. Only the specific, scanner-authored variants
              (<code>/wp-admin/</code>, <code>/administrator/</code>,{" "}
              <code>/phpmyadmin/</code>) are bait. The full list lives in{" "}
              <a
                className="underline"
                href="https://github.com/funcimp/func.lol/tree/main/research/tripwire"
                target="_blank"
                rel="noreferrer"
              >
                research/tripwire/
              </a>
              .
            </p>
          </section>

          <section className="mb-9">
            <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">References</h2>
            <ul className="list-disc pl-6 space-y-1.5 font-mono text-[13px]">
              <li>
                <a
                  className="underline"
                  href="https://news.ycombinator.com/item?id=44670319"
                  target="_blank"
                  rel="noreferrer"
                >
                  HN: Serving gzip bombs to scanners
                </a>
              </li>
              <li>
                <a
                  className="underline"
                  href="https://ache.one/notes/html_zip_bomb"
                  target="_blank"
                  rel="noreferrer"
                >
                  Ache, &ldquo;HTML Zip Bomb&rdquo;
                </a>
              </li>
              <li>
                <a
                  className="underline"
                  href="https://github.com/danielmiessler/SecLists"
                  target="_blank"
                  rel="noreferrer"
                >
                  SecLists (Daniel Miessler)
                </a>
              </li>
              <li>
                <a
                  className="underline"
                  href="https://github.com/projectdiscovery/nuclei-templates"
                  target="_blank"
                  rel="noreferrer"
                >
                  nuclei-templates (ProjectDiscovery)
                </a>
              </li>
              <li>
                <a
                  className="underline"
                  href="https://github.com/coreruleset/coreruleset"
                  target="_blank"
                  rel="noreferrer"
                >
                  OWASP CRS
                </a>
              </li>
              <li>
                <a
                  className="underline"
                  href="https://github.com/funcimp/func.lol/tree/main/research/tripwire"
                  target="_blank"
                  rel="noreferrer"
                >
                  research/tripwire/ (this repo)
                </a>
              </li>
            </ul>
          </section>
        </article>

        {/* V3 corner texture per DESIGN.md: single faint dither region. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed bottom-0 right-0 w-64 h-64 opacity-10"
          style={{
            background:
              "radial-gradient(circle at 85% 85%, currentColor 1px, transparent 1.5px)",
            backgroundSize: "8px 8px",
            maskImage: "linear-gradient(to top left, black, transparent 70%)",
            WebkitMaskImage: "linear-gradient(to top left, black, transparent 70%)",
          }}
        />
      </div>
    </main>
  )
}
