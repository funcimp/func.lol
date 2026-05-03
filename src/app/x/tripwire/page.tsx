// src/app/x/tripwire/page.tsx
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import ThemeToggle from "@/components/ThemeToggle"
import fixture from "@/app/x/tripwire/_fixtures/aggregates.sample.json"
import type { Aggregates } from "@/lib/tripwire/aggregate-shape"
import { getAggregates } from "@/lib/tripwire/aggregates"
import { BombDemo } from "./_components/BombDemo"
import { Hero, StatsPanel } from "./_components/StatsPanel"

const FIXTURE = fixture as Aggregates

export const metadata: Metadata = {
  title: "Tripwire",
  description:
    "An experiment in zip bombing bad actors who ignore robots.txt.",
}

// ISR: the stats blob is refreshed by the hourly cron at
// /api/cron/tripwire-stats. 5-minute revalidate gives stale-while-
// revalidate semantics. High-traffic pages re-render against the
// freshest blob in the background; low-traffic pages still see fresh
// data thanks to the cron.
export const revalidate = 300

// IPs are RFC 5737 documentation ranges (192.0.2.0/24, 198.51.100.0/24,
// 203.0.113.0/24). Reserved for examples, will never resolve to anyone
// real. Same-IP repeats are preserved across lines to keep the visual
// texture of a single scanner walking a target list.
const SAMPLE_LOG_LINES = [
  `192.0.2.41    "GET /wp-login.php HTTP/1.1"                  404  "Mozilla/5.0"`,
  `192.0.2.41    "GET /wp-config.php HTTP/1.1"                 404  "Mozilla/5.0"`,
  `198.51.100.3  "GET /.env HTTP/1.1"                          404  "curl/8.4.0"`,
  `203.0.113.7   "GET /actuator/env HTTP/1.1"                  404  "Nuclei/2.9"`,
  `203.0.113.7   "GET /actuator/heapdump HTTP/1.1"             404  "Nuclei/2.9"`,
  `192.0.2.66    "POST /xmlrpc.php HTTP/1.1"                   404  "Go-http-client/2.0"`,
  `198.51.100.91 "GET /phpunit/.../eval-stdin.php HTTP/1.1"    404  "-"`,
  `203.0.113.2   "GET /phpmyadmin/index.php HTTP/1.1"          404  "Mozilla/5.0"`,
]

function LogSample() {
  return (
    <pre
      aria-label="example scanner log lines"
      className="font-mono text-[11px] leading-[1.7] opacity-75 overflow-x-auto bg-black/5 dark:bg-white/5 p-4 my-6"
    >
      {SAMPLE_LOG_LINES.join("\n")}
    </pre>
  )
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="underline" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

// Async leaves: the blob fetch happens here, suspended out of the page
// shell so the response streams immediately and the numbers stream in
// when the fetch resolves.
async function HeroLive() {
  const aggregates = await getAggregates()
  return <Hero lifetime={aggregates.lifetime} />
}

async function StatsLive() {
  const aggregates = await getAggregates()
  return <StatsPanel aggregates={aggregates} />
}

export default function TripwirePage() {
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
            an experiment in zip bombing bad actors
          </p>
        </header>

        <Suspense fallback={<Hero lifetime={FIXTURE.lifetime} />}>
          <HeroLive />
        </Suspense>

        <article className="prose-hyphens text-[16px] leading-[1.65]">
          <section className="mb-9">
            <p>
              If you run a web server, your logs are full of probes and
              scanners looking for misconfigured systems. This site is
              running on Next.js. There&rsquo;s no PHP, no WordPress, no
              Spring Boot, no Java to be exploited. And yet I&rsquo;m
              constantly inundated with requests for{" "}
              <code>/wp-login.php</code>, <code>/.env</code>,{" "}
              <code>/actuator/env</code>, and a few hundred other paths
              that have nothing to do with anything I run.
            </p>

            <LogSample />

            <p>
              These are obviously bad actors who don&rsquo;t play by the
              rules. The right thing to do is set up a firewall rule and
              block them.
            </p>
            <p className="mt-4">
              I had a different (far dumber?) idea.
            </p>
          </section>

          <section className="mb-9">
            <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">
              The idea
            </h2>
            <p>
              The idea is simple. Instead of 404ing on these endpoints,
              what if I served back a{" "}
              <Ext href="https://en.wikipedia.org/wiki/Zip_bomb">zip bomb</Ext>{" "}
              that looks like a valid payload?
            </p>
            <p className="mt-4">
              I knew about zip bombs already. Small file on the wire,
              large file once decompressed. The trick relies on the
              decompressor doing the work after the bytes have already
              arrived. So could I exploit{" "}
              <Ext href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Encoding">
                <code>Content-Encoding: gzip</code>
              </Ext>{" "}
              on these 404 endpoints? Pick the paths scanners actually
              probe, prebuild a gzip body for each{" "}
              <Ext href="https://en.wikipedia.org/wiki/Media_type">MIME</Ext>{" "}
              the scanner expected, and turn every boring 404 into a
              200 that inflates straight into the crawler&rsquo;s
              process memory.
            </p>
            <p className="mt-4">
              It would bring me joy to crash some script kiddies&rsquo;
              dumb crawler code with an{" "}
              <Ext href="https://en.wikipedia.org/wiki/Out_of_memory">OOM</Ext>{" "}
              error. Or at least slow them down for a little bit.
            </p>
          </section>

          <section className="mb-9">
            <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">
              The trap
            </h2>
            <p>
              What if I made a carefully crafted{" "}
              <a href="/robots.txt" className="underline">
                robots.txt
              </a>{" "}
              that lists every one of these paths under{" "}
              <code>Disallow</code>? It does two things at once. It
              tells real crawlers like Googlebot, Bingbot, and
              archive.org to stay out of these paths, so they never
              get zip-bombed by accident. And it turns those same
              paths into a honeypot: anyone who shows up anyway has
              identified themselves as a scanner by ignoring a rule
              they were given. Instead of a 404, they get a gzip
              bomb.
            </p>
            <p className="mt-4">
              The numbers above are this site&rsquo;s slice of that
              traffic since the trap went live. Real scanners. Real
              hits. Their resources burn. Mine don&rsquo;t.
            </p>
          </section>

          <section className="mb-9">
            <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">
              The bomb
            </h2>
            <p>
              There&rsquo;s one bomb per MIME the scanner expected:
              HTML for admin panels, JSON for REST probes, YAML for
              config files, plain text for credential probes. The
              point is to keep their parser engaged after the inflate,
              not just their network stack. Credit to{" "}
              <Ext href="https://ache.one/notes/html_zip_bomb">
                Ache&rsquo;s HTML Zip Bomb
              </Ext>{" "}
              for refining the HTML variant.
            </p>
            <p className="mt-4">
              The production bombs inflate to about 2 GB. The buttons
              below serve a 2 MB version so you can sample the trick
              without your tab dying.
            </p>
          </section>
        </article>

        <section className="mb-12">
          <BombDemo />
        </section>

        <section className="mb-12">
          <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">
            The numbers
          </h2>
          <p className="text-[16px] leading-[1.65] mb-6">
            Once the trap was running, the next step was obvious. Share
            some of what I&rsquo;ve caught so far.
          </p>
          <Suspense fallback={<StatsPanel aggregates={FIXTURE} />}>
            <StatsLive />
          </Suspense>
        </section>

        <article className="prose-hyphens text-[16px] leading-[1.65]">
          <section className="mb-9">
            <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">
              A few notes on how this works
            </h2>
            <p>
              The bait list is one TypeScript module that two things
              import. The proxy imports it to match incoming requests.
              The <code>robots.txt</code> route imports it to emit{" "}
              <code>Disallow</code> lines. One source of truth, no
              drift.
            </p>
            <p className="mt-4">
              There&rsquo;s no{" "}
              <Ext href="https://en.wikipedia.org/wiki/User-Agent_header">
                User-Agent
              </Ext>{" "}
              allowlist. Real crawlers already respect{" "}
              <code>robots.txt</code>, so an allowlist would protect
              against a problem that doesn&rsquo;t exist. Meanwhile,
              scanners spoof crawler UAs constantly. An allowlist
              would mostly be a free bypass. Doing this right means{" "}
              <Ext href="https://en.wikipedia.org/wiki/Reverse_DNS_lookup">
                reverse-DNS
              </Ext>{" "}
              verification, which is real work for a hypothetical
              benefit.
            </p>
            <p className="mt-4">
              Generic paths are excluded: <code>/admin</code>,{" "}
              <code>/login</code>, <code>/dashboard</code>, anything
              reasonable a future page might want. Only the specific
              scanner-authored variants (<code>/wp-admin/</code>,{" "}
              <code>/administrator/</code>, <code>/phpmyadmin/</code>)
              are bait. The full list lives in{" "}
              <Ext href="https://github.com/funcimp/func.lol/tree/main/research/tripwire">
                research/tripwire/
              </Ext>
              , along with where each pattern came from.
            </p>
          </section>

          <section className="mb-9">
            <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">
              References
            </h2>
            <ul className="list-disc pl-6 space-y-1.5 font-mono text-[13px]">
              <li>
                <Ext href="https://news.ycombinator.com/item?id=44670319">
                  HN: Serving gzip bombs to scanners
                </Ext>
              </li>
              <li>
                <Ext href="https://ache.one/notes/html_zip_bomb">
                  Ache, &ldquo;HTML Zip Bomb&rdquo;
                </Ext>
              </li>
              <li>
                <Ext href="https://github.com/danielmiessler/SecLists">
                  SecLists (Daniel Miessler)
                </Ext>
              </li>
              <li>
                <Ext href="https://github.com/projectdiscovery/nuclei-templates">
                  nuclei-templates (ProjectDiscovery)
                </Ext>
              </li>
              <li>
                <Ext href="https://github.com/coreruleset/coreruleset">
                  OWASP CRS
                </Ext>
              </li>
              <li>
                <Ext href="https://github.com/funcimp/func.lol/tree/main/research/tripwire">
                  research/tripwire/ (this repo)
                </Ext>
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
