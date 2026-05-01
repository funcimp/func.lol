// drizzle.config.ts
//
// drizzle-kit doesn't auto-load .env.local. Run via dotenv-cli:
//   npx dotenv -e .env.local -- bunx drizzle-kit generate
//   npx dotenv -e .env.local -- bunx drizzle-kit migrate

import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  casing: "snake_case",
})
