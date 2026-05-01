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

tripwire-download-geoip *args:
    bun run scripts/tripwire/download-geoip.ts {{args}}

tripwire-build-stats *args:
    bun run scripts/tripwire/build-stats.ts {{args}}

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
