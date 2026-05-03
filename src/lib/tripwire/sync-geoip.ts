// src/lib/tripwire/sync-geoip.ts
//
// One job: pull a fresh GeoLite2-ASN.mmdb from MaxMind and put it in
// blob at geoip/GeoLite2-ASN.mmdb. Build-stats reads that blob.
// Refreshing the db never requires a redeploy.
//
// Pure library: no console.log, no process.exit. Both the CLI script
// and the cron route call this. Runs on Vercel's serverless runtime,
// so the tarball is decompressed and parsed in memory: no shelling out
// to tar, no temp files.

import { put } from "@vercel/blob"
import { gunzipSync } from "node:zlib"

const DOWNLOAD_URL =
  "https://download.maxmind.com/geoip/databases/GeoLite2-ASN/download?suffix=tar.gz"
export const ASN_BLOB_KEY = "geoip/GeoLite2-ASN.mmdb"
const MMDB_NAME = "GeoLite2-ASN.mmdb"

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

// POSIX ustar header. We only need name, size, typeflag, prefix.
// https://www.gnu.org/software/tar/manual/html_node/Standard.html
const BLOCK = 512

function readCString(buf: Buffer, offset: number, len: number): string {
  let end = offset
  const max = offset + len
  while (end < max && buf[end] !== 0) end++
  return buf.toString("utf8", offset, end)
}

function readOctal(buf: Buffer, offset: number, len: number): number {
  let start = offset
  let end = offset + len
  while (end > start && (buf[end - 1] === 0 || buf[end - 1] === 0x20)) end--
  while (start < end && buf[start] === 0x20) start++
  if (start === end) return 0
  return parseInt(buf.toString("ascii", start, end), 8)
}

// Find a file in a gzipped tar by basename. Throws if absent.
export function extractFileFromTarGz(tarball: Buffer, basename: string): Buffer {
  const data = gunzipSync(tarball)
  let offset = 0
  while (offset + BLOCK <= data.length) {
    // End-of-archive marker is a zero block. The name field is at the
    // start of the header, so a zero first byte means no more entries.
    if (data[offset] === 0) break

    const name = readCString(data, offset, 100)
    const size = readOctal(data, offset + 124, 12)
    const typeflag = data[offset + 156]
    const prefix = readCString(data, offset + 345, 155)
    const fullName = prefix ? `${prefix}/${name}` : name
    // typeflag '0' (0x30) or NUL = regular file
    const isFile = typeflag === 0 || typeflag === 0x30

    offset += BLOCK
    if (isFile && (fullName === basename || fullName.endsWith(`/${basename}`))) {
      return Buffer.from(data.subarray(offset, offset + size))
    }
    offset += Math.ceil(size / BLOCK) * BLOCK
  }
  throw new Error(`${basename} not found in tarball`)
}

export async function syncGeoipToBlob(): Promise<SyncGeoipResult> {
  const accountId = process.env.MAXMIND_ACCOUNT_ID
  const licenseKey = process.env.MAXMIND_LICENSE_KEY
  if (!accountId || !licenseKey) {
    throw new Error("MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY must be set")
  }

  const tarball = await downloadTarball(accountId, licenseKey)
  const mmdb = extractFileFromTarGz(tarball, MMDB_NAME)

  await put(ASN_BLOB_KEY, mmdb, {
    access: "private",
    contentType: "application/octet-stream",
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  return {
    tarballBytes: tarball.length,
    mmdbBytes: mmdb.length,
    blobKey: ASN_BLOB_KEY,
  }
}
