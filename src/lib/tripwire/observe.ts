// src/lib/tripwire/observe.ts
import { createHash } from "node:crypto"

export function hashIP(ip: string): string {
  const salt = process.env.TRIPWIRE_IP_SALT ?? ""
  const digest = createHash("sha256").update(ip + salt).digest("hex").slice(0, 16)
  return `sha256:${digest}`
}

// Stubs. Real implementations land in Tasks 8 (uaFamily) and 9-10 (guard).
// These exist only so the shared test file imports resolve today.
export function uaFamily(_ua: string): string {
  return "stub"
}

export function guard(_ipHash: string): boolean {
  return true
}
