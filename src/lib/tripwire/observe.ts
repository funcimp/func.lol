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

// Stub. Real implementation lands in Tasks 9-10.
// Exists so the shared test file imports resolve today.
export function guard(_ipHash: string): boolean {
  return true
}
