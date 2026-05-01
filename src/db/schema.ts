// src/db/schema.ts
//
// Tripwire silver layer. The bronze layer is one JSON file per event under
// the events/ blob prefix, written by src/proxy.ts at request time. The
// ingest script copies each new bronze event into this table, enriches it
// with ASN data from the bundled GeoLite2-ASN.mmdb, and never touches the
// row again. The aggregate JSON the stats page reads is derived from this
// table by SQL — no JSON-parse loop, no full re-mirror, no full rebuild.
//
// id is the unique slug from the blob filename (events/<date>/<ms>-<id>.json),
// always present and naturally unique. Using it as the primary key lets the
// ingest script skip already-imported files with a single SELECT against
// the candidate id list.

import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core"

export const tripwireEvents = pgTable(
  "tripwire_events",
  {
    id: text("id").primaryKey(),
    reqId: text("req_id"),
    event: text("event").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    path: text("path").notNull(),
    pattern: text("pattern").notNull(),
    ip: text("ip").notNull(),
    query: text("query"),
    category: text("category"),
    bomb: text("bomb"),
    uaRaw: text("ua_raw"),
    uaFamily: text("ua_family"),
    asn: text("asn"),
    asnName: text("asn_name"),
    blobPathname: text("blob_pathname").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tripwire_events_ts_idx").on(t.ts),
    index("tripwire_events_category_idx").on(t.category),
    index("tripwire_events_asn_idx").on(t.asn),
    index("tripwire_events_path_idx").on(t.path),
  ],
)

export type TripwireEventRow = typeof tripwireEvents.$inferSelect
export type NewTripwireEventRow = typeof tripwireEvents.$inferInsert
