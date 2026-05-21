// e2e/fixtures/aggregates.ts
//
// Realistic but synthetic Aggregates payload. Seeded into the fake blob
// server on startup so `/x/tripwire` renders real numbers in E2E
// instead of an error boundary. Numbers are deliberately distinctive
// (12345, 678 ASNs, etc.) so test assertions can spot them.

import type { Aggregates } from "../../src/lib/tripwire/aggregate-shape"

export const FIXTURE_AGGREGATES: Aggregates = {
  generatedAt: "2026-05-21T00:00:00.000Z",
  lifetime: {
    totalEvents: 12345,
    earliestTs: "2026-04-25T00:00:00.000Z",
    latestTs: "2026-05-21T00:00:00.000Z",
    daysSinceFirst: 26,
    distinctIps: 4321,
    distinctPaths: 89,
    distinctAsns: 678,
  },
  byCategory: [
    { category: "wp-admin", count: 5000 },
    { category: "env-files", count: 3200 },
    { category: "phpmyadmin", count: 2100 },
    { category: "actuator", count: 1045 },
  ],
  byUaFamily: [
    { ua: "curl", count: 4200 },
    { ua: "Mozilla", count: 3800 },
    { ua: "Go-http-client", count: 2100 },
  ],
  byDay: [
    { date: "2026-05-19", count: 800 },
    { date: "2026-05-20", count: 950 },
    { date: "2026-05-21", count: 1100 },
  ],
  topPaths: [
    { path: "/wp-login.php", count: 3200, category: "wp-admin" },
    { path: "/.env", count: 2100, category: "env-files" },
    { path: "/phpmyadmin/", count: 1500, category: "phpmyadmin" },
  ],
  byAsn: [
    { asn: "AS14061", name: "DigitalOcean", count: 2200 },
    { asn: "AS16509", name: "Amazon", count: 1800 },
    { asn: "AS24940", name: "Hetzner", count: 1100 },
  ],
}
