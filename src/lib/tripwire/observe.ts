// src/lib/tripwire/observe.ts
import { createHash } from "node:crypto"

export function hashIP(ip: string): string {
  const salt = process.env.TRIPWIRE_IP_SALT ?? ""
  if (!salt && process.env.NODE_ENV === "production") {
    throw new Error("TRIPWIRE_IP_SALT is required in production")
  }
  const digest = createHash("sha256").update(ip + salt).digest("hex").slice(0, 16)
  return `sha256:${digest}`
}

// First match wins. Ordering matters: narrower patterns (python-requests)
// must appear before broader ones (python) so the more specific label
// carries the day. Word boundaries guard only patterns whose tokens are
// common English fragments (ffuf, curl, wget); scanner names like "nuclei"
// are distinctive enough that substring match is fine and catches renamed
// variants (NucleiScanner, NmapBot, etc.) under the same family.
const UA_FAMILIES: Array<[RegExp, string]> = [
  [/nuclei/i,                   "nuclei"],
  [/zgrab/i,                    "zgrab"],
  [/masscan/i,                  "masscan"],
  [/nmap/i,                     "nmap"],
  [/gobuster/i,                 "gobuster"],
  [/\bffuf\b/i,                 "ffuf"],
  [/python-requests/i,          "requests"],
  [/python-urllib|\bpython\b/i, "python"],
  [/\bcurl\//i,                 "curl"],
  [/\bwget\//i,                 "wget"],
  [/go-http-client/i,           "go-http-client"],
  [/googlebot/i,                "googlebot"],
  [/bingbot/i,                  "bingbot"],
  [/duckduckbot/i,              "duckduckbot"],
  [/applebot/i,                 "applebot"],
  [/yandexbot/i,                "yandexbot"],
  [/baiduspider/i,              "baiduspider"],
]

export function uaFamily(ua: string): string {
  for (const [re, family] of UA_FAMILIES) {
    if (re.test(ua)) return family
  }
  return "unknown"
}

const PER_IP_LIMIT = 30
const TOTAL_LIMIT = 1000
const WINDOW_MS = 60_000

interface Entry {
  count: number
  resetAt: number
}

const perIp = new Map<string, Entry>()
let globalCount = 0
let globalResetAt = 0

export function guard(ipHash: string): boolean {
  const now = Date.now()

  if (now > globalResetAt) {
    globalCount = 0
    globalResetAt = now + WINDOW_MS
  }
  if (globalCount >= TOTAL_LIMIT) return false

  let entry = perIp.get(ipHash)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS }
    perIp.set(ipHash, entry)
  }
  if (entry.count >= PER_IP_LIMIT) return false

  entry.count++
  globalCount++
  return true
}

// Test-only reset. Not used at runtime. Resets all per-IP entries and the
// global counter so unit tests can start each case from a known state.
export function resetGuardForTests(): void {
  perIp.clear()
  globalCount = 0
  globalResetAt = 0
}
