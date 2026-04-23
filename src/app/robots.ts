// src/app/robots.ts
import type { MetadataRoute } from "next"
import { PATTERNS } from "@/lib/tripwire/patterns"

export default function robots(): MetadataRoute.Robots {
  const disallow = Array.from(
    new Set(
      PATTERNS
        .filter((p) => p.shape === "prefix")
        .map((p) => p.token),
    ),
  ).sort()

  return {
    rules: { userAgent: "*", disallow },
    sitemap: "https://func.lol/sitemap.xml",
  }
}
