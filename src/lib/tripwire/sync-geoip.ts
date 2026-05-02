// src/lib/tripwire/sync-geoip.ts
//
// One job: pull a fresh GeoLite2-ASN.mmdb from MaxMind and put it in
// blob at geoip/GeoLite2-ASN.mmdb. Build-stats reads that blob.
// Refreshing the db never requires a redeploy.
//
// Pure library: no console.log, no process.exit. Both the CLI script
// and the cron route call this.

import { put } from "@vercel/blob"
import { spawnSync } from "node:child_process"
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

const DOWNLOAD_URL =
  "https://download.maxmind.com/geoip/databases/GeoLite2-ASN/download?suffix=tar.gz"
export const ASN_BLOB_KEY = "geoip/GeoLite2-ASN.mmdb"

export interface SyncGeoipResult {
  tarballBytes: number
  mmdbBytes: number
  blobKey: string
}

async function downloadTarball(
  accountId: string,
  licenseKey: string,
): Promise<Buffer> {
  const auth = Buffer.from(`${accountId}:${licenseKey}`).toString("base64")
  const res = await fetch(DOWNLOAD_URL, {
    headers: { Authorization: `Basic ${auth}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `MaxMind download failed: ${res.status} ${res.statusText}. ${body.slice(0, 200)}`,
    )
  }
  return Buffer.from(await res.arrayBuffer())
}

// Tarball structure: GeoLite2-ASN_<YYYYMMDD>/GeoLite2-ASN.mmdb. Extract
// to a fresh tmp dir and walk one directory deep to find the .mmdb.
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

export async function syncGeoipToBlob(): Promise<SyncGeoipResult> {
  const accountId = process.env.MAXMIND_ACCOUNT_ID
  const licenseKey = process.env.MAXMIND_LICENSE_KEY
  if (!accountId || !licenseKey) {
    throw new Error("MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY must be set")
  }

  const tarball = await downloadTarball(accountId, licenseKey)

  const tmp = await mkdtemp(join(tmpdir(), "geolite2-asn-"))
  try {
    const tarballPath = join(tmp, "GeoLite2-ASN.tar.gz")
    await writeFile(tarballPath, tarball)
    const mmdbPath = await extractMmdb(tarballPath, tmp)
    const mmdbBytes = await readFile(mmdbPath)

    await put(ASN_BLOB_KEY, mmdbBytes, {
      access: "private",
      contentType: "application/octet-stream",
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    return {
      tarballBytes: tarball.length,
      mmdbBytes: mmdbBytes.length,
      blobKey: ASN_BLOB_KEY,
    }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}
