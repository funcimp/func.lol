// src/lib/tripwire/patterns.ts

export type BombKind = "html" | "json" | "yaml" | "env"

export type Category =
  | "cms"
  | "framework"
  | "config"
  | "admin"
  | "actuator"
  | "cgi"
  | "metadata"
  | "webshell"

export type PatternShape = "prefix" | "substring"

export interface Pattern {
  token: string
  shape: PatternShape
  category: Category
}

export const categoryToBomb: Record<Category, BombKind> = {
  cms: "html",
  framework: "html",
  admin: "html",
  webshell: "html",
  cgi: "html",
  actuator: "json",
  metadata: "json",
  config: "env",
}

// Strict prefix match. Anything under these paths is never bait.
export const SAFE_PREFIXES: readonly string[] = [
  "/_next/",
  "/api/",
  "/.well-known/",
  "/x/",
  "/static/",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/health",
  "/healthz",
  "/status",
  "/ping",
]

// Exact match only. "/admin/something" may still be bait, "/admin" is not.
export const SAFE_EXACT_PATHS: readonly string[] = [
  "/",
  "/admin",
  "/login",
  "/signup",
  "/register",
  "/dashboard",
]

// Populated in Task 1b from research/tripwire/patterns.md.
export const PATTERNS: Pattern[] = []
