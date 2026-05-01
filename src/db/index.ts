// src/db/index.ts
//
// Lazy drizzle client. The neon() call would throw at module load if
// DATABASE_URL is missing, which crashes `next build` on first deploy
// before Marketplace env vars are wired up. getDb() defers the connection
// until first use, which means top-level imports are safe at build time.

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

let _db: ReturnType<typeof createDb> | null = null

function createDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  const sql = neon(url)
  return drizzle(sql, { schema })
}

export function getDb() {
  if (!_db) _db = createDb()
  return _db
}

export { schema }
