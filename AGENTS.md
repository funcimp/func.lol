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
