// scripts/trigger-archive.ts
//
// Manually fire the tripwire archiver cron endpoint. Useful to validate the
// Vercel Logs API shape, confirm Blob writes, or kick the archive off-cadence
// without waiting for 03:00 / 15:00 UTC.
//
// Reads CRON_SECRET from the environment (bun auto-loads .env.local).
// Defaults to production; pass a URL as the first arg to target a preview.
//
// Examples:
//   bun run tripwire:archive
//   bun run tripwire:archive https://func-abc123.vercel.app/api/cron/tripwire-archive

const DEFAULT_URL = "https://func.lol/api/cron/tripwire-archive"

async function main(): Promise<void> {
  const url = process.argv[2] ?? DEFAULT_URL
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error("CRON_SECRET is not set. Export it, or add to .env.local:")
    console.error("  CRON_SECRET=$(openssl rand -hex 32)  # first-time generation")
    console.error("  # or pull from Vercel: vercel env pull .env.local")
    process.exit(1)
  }

  console.log(`[tripwire] POST-ish fire: ${url}`)
  const start = Date.now()
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
  })
  const ms = Date.now() - start
  const body = await res.text()

  console.log(`[tripwire] ${res.status} ${res.statusText} (${ms} ms)`)
  try {
    console.log(JSON.stringify(JSON.parse(body), null, 2))
  } catch {
    console.log(body)
  }

  if (!res.ok) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
