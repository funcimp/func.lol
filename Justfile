# Justfile — project command orchestration.
# Run `just` (no args) for a recipe listing.

default:
    @just --list

# === Tripwire ops ===

tripwire-sync *args:
    bun run scripts/tripwire/sync.ts {{args}}

tripwire-analyze-404s *args:
    bun run scripts/tripwire/analyze-404s.ts {{args}}

tripwire-build-bombs:
    bun run scripts/tripwire/build-bombs.ts

# Pull a fresh GeoLite2-ASN.mmdb from MaxMind and put it in blob at
# geoip/GeoLite2-ASN.mmdb. The cron's ASN enrichment reads from blob,
# so refreshing the db here is independent of any deploy.
tripwire-sync-geoip-to-blob:
    bun run scripts/tripwire/sync-geoip-to-blob.ts

tripwire-ingest-events *args:
    bun run scripts/tripwire/ingest-events.ts {{args}}

tripwire-build-stats *args:
    bun run scripts/tripwire/build-stats.ts {{args}}

# Ingest any new bronze events into Neon and rebuild the aggregate JSON.
# Pass --upload to also publish to blob.
tripwire-update-stats *args:
    just tripwire-ingest-events
    just tripwire-build-stats {{args}}

# === Database (Drizzle + Neon) ===
# drizzle-kit doesn't load .env.local on its own, so wrap it in dotenv-cli.

db-generate:
    bunx dotenv -e .env.local -- bunx drizzle-kit generate

db-migrate:
    bunx dotenv -e .env.local -- bunx drizzle-kit migrate

db-studio:
    bunx dotenv -e .env.local -- bunx drizzle-kit studio

# === General dev ===

dev:
    bun run dev

build:
    bun run build

start:
    bun run start

# === Quality ===

lint:
    bun run lint

test:
    bun test

e2e:
    bunx playwright test

e2e-ui:
    bunx playwright test --ui
