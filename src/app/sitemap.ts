// src/app/sitemap.ts
//
// Static sitemap. Lists the canonical pages on func.lol so search engines
// (and any compliant crawler that reads robots.txt) can discover them.
//
// Dynamic routes like /x/prime-moments/[constellation] are intentionally
// omitted — there are many constellations and they're discoverable from
// /x/prime-moments and /x/prime-moments/browse anyway.

import type { MetadataRoute } from "next"

const BASE_URL = "https://func.lol"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${BASE_URL}/`,                    lastModified: now },
    { url: `${BASE_URL}/x`,                   lastModified: now },
    { url: `${BASE_URL}/x/prime-moments`,     lastModified: now },
    { url: `${BASE_URL}/x/prime-moments/browse`, lastModified: now },
    { url: `${BASE_URL}/x/tripwire`,          lastModified: now },
  ]
}
