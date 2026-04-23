// src/app/x/tripwire/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Tripwire — func.lol",
  description:
    "A consent-based trap for automated scanners. robots.txt publishes the rules. Ignoring them trips the wire.",
};

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
            robots.txt publishes the rules. ignoring them trips the wire.
          </p>
        </header>

        <article className="prose-hyphens text-[16px] leading-[1.65]">
          <section className="mb-9">
            <p>
              Every public web server gets scanned. Not occasionally. Constantly.
              The traffic is dominated by automated probes for known-vulnerable
              endpoints: <code>/.env</code>, <code>/wp-login.php</code>,{" "}
              <code>/phpunit/src/Util/PHP/eval-stdin.php</code>,{" "}
              <code>/actuator/env</code>, and hundreds more. The scanners fire
              at every IPv4 address they can route to, they ignore{" "}
              <code>robots.txt</code>, and they do not care about 404s.
            </p>
          </section>

          <section className="mb-9">
            <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">The trap</h2>
            <p>
              The experiment is a consent-based trap. Publish the bait paths in{" "}
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
              for refining the HTML variant.
            </p>
          </section>

          <section className="mb-9">
            <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">The matcher</h2>
            <p>
              One TypeScript module owns the bait list. The proxy imports it for
              matching. The <code>robots.txt</code> route imports it for{" "}
              <code>Disallow</code> emission. No drift. There is no
              UA allowlist: without reverse-DNS verification, trusting UA is a
              free bypass for spoofers rather than a shield for real crawlers,
              and real crawlers already respect <code>robots.txt</code>. An
              in-memory rate limit bounds how much bandwidth a single attacker
              can extract from this site, falling through to a normal 404 once
              the breaker trips.
            </p>
            <p className="mt-4">
              The bait list has a structural asymmetry worth naming. Some
              tokens (e.g., <code>eval-stdin.php</code>) are substring matches
              that cannot appear in <code>robots.txt</code>, which only speaks
              in path prefixes. Their canonical prefix forms do appear. A
              scanner that hits a substring-only match has still hit a token
              that is definitionally a scanner signature, so the consent
              framing still stands.
            </p>
          </section>

          <section className="mb-9">
            <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">
              Why not a UA allowlist
            </h2>
            <p>
              Early drafts carved out bait-path requests from known-good
              crawler UAs (<code>Googlebot</code>, <code>bingbot</code>, etc.)
              on the theory that a hypothetically misbehaving real crawler
              deserved protection. The argument fails under inspection. Real
              Googlebot follows <code>robots.txt</code> and does not hit bait
              paths, so the allowlist protects against a scenario that does not
              occur. Meanwhile, scanners routinely spoof crawler UAs precisely
              because many servers treat them as trusted. A UA allowlist
              without IP verification is therefore a free bypass for spoofers,
              not a shield for real crawlers. The right implementation pairs UA
              matching with reverse-DNS verification, which is real work and
              belongs in a version where we have evidence the protection is
              needed.
            </p>
          </section>

          <section className="mb-9">
            <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">Exclusions</h2>
            <p>
              A safe-path allowlist protects legitimate routes. Anything under{" "}
              <code>/_next/</code>, <code>/api/</code>, <code>/x/</code>,{" "}
              <code>/.well-known/</code>, <code>/static/</code>, and common
              health-check names never matches. Generic paths like{" "}
              <code>/admin</code>, <code>/login</code>, <code>/dashboard</code>{" "}
              are excluded too. Only the specific, scanner-authored variants
              (<code>/wp-admin/</code>, <code>/administrator/</code>,{" "}
              <code>/phpmyadmin/</code>) are bait. The research dossier at{" "}
              <a
                className="underline"
                href="https://github.com/funcimp/func.lol/tree/main/research/tripwire"
                target="_blank"
                rel="noreferrer"
              >
                research/tripwire/
              </a>{" "}
              has the full list with sources.
            </p>
          </section>

          <section className="mb-9">
            <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-3">What is next</h2>
            <p>
              v1 does not surface any stats on this page. Events land in
              structured logs and are archived daily to private storage for
              later analysis. v2 will read those archives and add a stats
              panel. v3 is an intelligent pattern-discovery pass over the rest
              of the 404 stream to surface new bait candidates. Both are parked
              in{" "}
              <a
                className="underline"
                href="https://github.com/funcimp/func.lol/blob/main/IDEAS.md"
                target="_blank"
                rel="noreferrer"
              >
                IDEAS.md
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
  );
}
