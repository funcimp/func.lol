# Agent Development Guide for func.lol

Lab experiments by Functionally Imperative. Built in public, Unlicense / public domain.

> **This is a public, open source repository.** Everything committed here — code, comments, commit messages, issues — is world-readable forever. Do not add secrets, private notes, internal links, personal data, or anything you wouldn't want on the front page of the internet.

## Stack

- Next.js (App Router) + React + TypeScript
- Tailwind v4 + daisyUI (locked to the `dark` theme)
- Bun as package manager and runtime
- ESLint via `eslint-config-next`
- Deployed on Vercel

## Principles

- **Always start simple.** Prefer the smallest thing that works. No speculative abstraction, no premature config.
- **All architecture decisions go through the maintainer.** Never vibe architecture. If a change touches structure, dependencies, or conventions, surface it and wait for a decision.
- **Minimalist by default.** Don't add files, deps, or features that weren't asked for.
- **If you are confused, ask.** Do not guess at intent, invent requirements, or paper over uncertainty with plausible-looking code. Stop and ask a direct question.

## Influences

The author cares deeply about the writings of **John Ousterhout**, **Brian Kernighan**, and **Rob Pike**. Books like *A Philosophy of Software Design* and *The Practice of Programming* are foundational here. Favor: deep modules with simple interfaces, information hiding, clarity over cleverness, small sharp tools, and designs that are obvious to read. When a decision is in tension, lean toward what these authors would call simple.

## Tooling

- **Always use `bun` and `bunx`.** Never `npm`, `npx`, `yarn`, or `pnpm`. This applies to installing, running scripts, and one-off command execution.

## Contributions

This project is built in public. **Issues are welcome, pull requests are not.** Do not solicit or accept code contributions. If someone offers a PR, thank them and point them to filing an issue instead.

## Dependency policy

- **Patch / minor bumps:** fine anytime via `bun update`.
- **Major bumps on framework-adjacent deps** (`next`, `react`, `react-dom`, `typescript`, `eslint`, `eslint-config-next`, `tailwindcss`, `daisyui`): **wait** until the framework (Next.js) explicitly supports them. Taking these early tends to surface obscure type / lint / build errors with no upside.
- **`@types/node`:** pin to the major version that matches the deployed runtime on Vercel (currently Node 22), not "latest."
- `bun outdated` will list newer majors even when caret ranges don't permit them — that's informational, not a signal to bump.
