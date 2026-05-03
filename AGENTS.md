# AGENTS.md

Experiments by Functionally Imperative. Public domain. Built in public.

> **Public, forever.** No secrets, no private notes, no internal links. Everything here is world-readable.

## Stack

- Next.js (App Router) + React + TypeScript
- Tailwind v4 with a hand-authored `@theme` token system (see [DESIGN.md](DESIGN.md))
- Bun as package manager, test runner, and runtime
- ESLint via `eslint-config-next`
- Deployed on Vercel

## Principles

- Start simple. Add only what survives scrutiny.
- Ask if you're confused. Don't guess.
- Experiments are self-contained. No sibling apps, no separate hosts. Experiments ship with func.lol.
- No func.lol route uses a path that matches a pattern in `src/lib/tripwire/patterns.ts`. The patterns module is the authoritative list. If a future page needs a forbidden path, remove the pattern first.

## Architectural changes require maintainer approval

Never change software architecture, runtime config, or platform settings without discussing with the maintainer first. This includes — non-exhaustively — caching strategies (ISR, `unstable_cache`, `'use cache'`, module-level singletons, fetch caching), Suspense / streaming patterns, error-boundary placement, runtime exports (`runtime`, `revalidate`, `dynamic`), `vercel.json` cron schedules and `bunVersion`, `next.config.ts` flags. Present the evidence and the candidate change, then wait for direction. "Auto mode" does not include architectural decisions.

## Claims about platform behavior need primary sources

Any statement about how Next.js, Bun, Vercel, Neon, `@vercel/blob`, or other platform components behave must be backed by a primary source — official docs, the package's source / type definitions, an official changelog, or a reproducible local experiment. Pattern-matching on symptoms ("looks like a Bun bug") is not evidence. If you don't have a source, say "I don't know" instead of speculating.

## Simplification means stripping to essence, not swapping complexity

When asked to simplify, the correct move is to remove the smallest viable surface and prove the remainder works against real data. Removing one abstraction while introducing two new ones is not simplification.

## Influences

Ousterhout, Kernighan, Pike. Favor deep modules, simple interfaces, clarity over cleverness.

## Design

See [DESIGN.md](DESIGN.md). Read it before any UI change.

## Tooling

Always `bun` and `bunx`. Never `npm`, `npx`, `yarn`, or `pnpm`.

## Contributions

Issues welcome. Pull requests are not. Thank offers of PRs and redirect them to file an issue.

## Pull requests

Solo project. PRs are history, not peer review. Summary only, no test plans or checklists.

## Dependency policy

- Patch and minor bumps: fine via `bun update`.
- Major bumps on framework-adjacent deps (`next`, `react`, `react-dom`, `typescript`, `eslint`, `eslint-config-next`, `tailwindcss`): wait until Next.js supports them.
- `@types/node`: pin to the Vercel runtime major (Node 22).
