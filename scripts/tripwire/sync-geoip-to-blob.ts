// scripts/tripwire/sync-geoip-to-blob.ts
//
// Downloads GeoLite2-ASN.mmdb from MaxMind and uploads it to blob at
// geoip/GeoLite2-ASN.mmdb. Run this manually whenever MaxMind ships a
// new release (they update weekly; once a month is plenty for a hobby
// scale). The tripwire cron reads this blob at runtime, so refreshing
// the db never requires a redeploy.
//
// Reads MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY from .env.local
// (bun auto-loads). BLOB_READ_WRITE_TOKEN must also be set so the
// blob put can authenticate.

import { put } from "@vercel/blob"
import { spawnSync } from "node:child_process"
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

const DOWNLOAD_URL =
  "https://download.maxmind.com/geoip/databases/GeoLite2-ASN/download?suffix=tar.gz"
export const ASN_BLOB_KEY = "geoip/GeoLite2-ASN.mmdb"

async function downloadTarball(
  url: string,
  accountId: string,
  licenseKey: string,
): Promise<Buffer> {
  const auth = Buffer.from(`${accountId}:${licenseKey}`).toString("base64")
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `MaxMind download failed: ${res.status} ${res.statusText}. ${body.slice(0, 200)}`,
    )
  }
  return Buffer.from(await res.arrayBuffer())
}

// Tarball structure: GeoLite2-ASN_<YYYYMMDD>/GeoLite2-ASN.mmdb. Extract
// to a fresh tmp dir, then walk one directory deep to find the .mmdb.
async function extractMmdb(tarballPath: string, extractDir: string): Promise<string> {
  const result = spawnSync("tar", ["-xzf", tarballPath, "-C", extractDir], {
    encoding: "utf8",
  })
  if (result.status !== 0) {
    throw new Error(`tar extraction failed (status=${result.status}): ${result.stderr}`)
  }
  const entries = await readdir(extractDir)
  for (const entry of entries) {
    const candidate = join(extractDir, entry, "GeoLite2-ASN.mmdb")
    try {
      await stat(candidate)
      return candidate
    } catch {
      // keep looking
    }
  }
  throw new Error("GeoLite2-ASN.mmdb not found in extracted tarball")
}

async function main(): Promise<void> {
  const accountId = process.env.MAXMIND_ACCOUNT_ID
  const licenseKey = process.env.MAXMIND_LICENSE_KEY
  if (!accountId || !licenseKey) {
    throw new Error(
      "MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY must be set (in .env.local for local).",
    )
  }

  console.log("[sync-geoip] downloading from MaxMind...")
  const tarball = await downloadTarball(DOWNLOAD_URL, accountId, licenseKey)
  console.log(`[sync-geoip] downloaded ${tarball.length} bytes`)

  const tmp = await mkdtemp(join(tmpdir(), "geolite2-asn-"))
  try {
    const tarballPath = join(tmp, "GeoLite2-ASN.tar.gz")
    await writeFile(tarballPath, tarball)
    const mmdbPath = await extractMmdb(tarballPath, tmp)
    const mmdbBytes = await readFile(mmdbPath)
    console.log(`[sync-geoip] extracted ${mmdbBytes.length} bytes`)

    console.log(`[sync-geoip] uploading to blob at ${ASN_BLOB_KEY}...`)
    await put(ASN_BLOB_KEY, mmdbBytes, {
      access: "private",
      contentType: "application/octet-stream",
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    console.log("[sync-geoip] done.")
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
