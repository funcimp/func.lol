#!/usr/bin/env bash
# scripts/tripwire/diag-preview-crons.sh
#
# Hit each tripwire cron route on a Vercel preview deployment with both
# the cron bearer auth and the Vercel deployment-protection bypass.
# Use to capture a per-step debug trace from inside a Function instance
# without merging or deploying to production.
#
# Usage:
#   scripts/tripwire/diag-preview-crons.sh <preview-url>
#
# Requires in env (load via .env.local, e.g. `set -a; source .env.local; set +a`):
#   CRON_SECRET
#   VERCEL_AUTOMATION_BYPASS_SECRET

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <preview-url>" >&2
  exit 2
fi

PREVIEW_URL="${1%/}"  # trim trailing slash

: "${CRON_SECRET:?CRON_SECRET must be set in env}"
: "${VERCEL_AUTOMATION_BYPASS_SECRET:?VERCEL_AUTOMATION_BYPASS_SECRET must be set in env}"

# Order: never-worked first (fastest signal), then known-timeout, then
# the one that occasionally works. Each call is sequential so curl waits
# for the function to either respond or hit its maxDuration.
for cron in tripwire-asn-update tripwire-build-stats tripwire-ingest; do
  echo "=== $cron ==="
  curl -sS --max-time 360 \
       -H "Authorization: Bearer $CRON_SECRET" \
       -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" \
       "$PREVIEW_URL/api/cron/$cron" \
    || echo "(curl exit $?)"
  echo
done
