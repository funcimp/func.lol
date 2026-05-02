// scripts/tripwire/sync-geoip-to-blob.ts
//
// CLI wrapper around src/lib/tripwire/sync-geoip.ts. The cron route at
// /api/cron/tripwire-asn-update imports the same library function.
//
// Usage:
//   bun run scripts/tripwire/sync-geoip-to-blob.ts

import { syncGeoipToBlob } from "@/lib/tripwire/sync-geoip"

async function main(): Promise<void> {
  console.log("[sync-geoip] downloading from MaxMind + uploading to blob...")
  const result = await syncGeoipToBlob()
  console.log(
    `[sync-geoip] tarball=${result.tarballBytes} bytes, mmdb=${result.mmdbBytes} bytes, ` +
      `uploaded to ${result.blobKey}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
