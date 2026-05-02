import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tripwire ships pre-compressed gzip bodies via the proxy with
  // Content-Encoding: gzip set explicitly. Next.js's built-in compression
  // strips that header during its own encoding negotiation. Disable so our
  // header survives. On Vercel this option is ignored (edge handles
  // compression), but it makes local dev and self-hosted behavior match.
  compress: false,

  // Keep both /phpmyadmin/ and /phpmyadmin scanner probes flowing to the
  // tripwire proxy. Next.js's default 308 trailing-slash normalization would
  // otherwise swallow one form before the proxy ever runs, and scanners that
  // do not follow redirects would escape the trap.
  skipTrailingSlashRedirect: true,

  // Bundle the MaxMind ASN db with the cron route's function so
  // Reader.open() can find it at runtime. Without this, Vercel's tracer
  // wouldn't pull a non-imported binary file into the deploy.
  outputFileTracingIncludes: {
    "/api/cron/tripwire-stats": ["data/GeoLite2-ASN.mmdb"],
  },
};

export default nextConfig;
