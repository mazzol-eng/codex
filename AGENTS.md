# BotHub contributor guide

## Commands (repository root)

- Install: `pnpm install --frozen-lockfile` (Node >=22.12, pnpm 11.19).
- Services: `docker compose up -d --wait`.
- Database: `pnpm db:generate`; `pnpm db:seed` applies migrations then seeds demo data.
- Run: `pnpm dev` (web port 3000; worker currently idle).
- Validate: `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- Browser tests: `pnpm exec playwright install chromium`, then `pnpm test:e2e`.
- Production build: `pnpm build`. Format: `pnpm format`.

## Structure

`apps/web` contains the Next.js site and dashboard; `apps/worker` hosts asynchronous jobs.
`packages/db` contains Prisma schema, migrations, seed and tenant-scoped repositories.
`packages/core` contains ports, queue, logging and encryption. `packages/channels` defines
channel contracts. `packages/flow-engine` is pure TypeScript, with no I/O.
`config/brand.ts` is the only brand/color source. `docs/DECISIONS.md` records tradeoffs.

## Conventions

Strict TypeScript, English code/identifiers and Conventional Commits; pt-BR product copy.
Use existing isolated checkouts; do not create Git worktrees unless explicitly requested.
Keep external services behind ports with fake implementations. Never require real keys for tests.
Never log credentials or message bodies. Persist channel credentials only with AES-256-GCM.
Business reads/writes must be scoped to an authorized workspace, checked server-side.
Never trust a workspace ID or role from client input without checking membership.
Use zod at boundaries, accessible controls, reduced-motion support and centralized tokens.
Phases 0 and 1 only in the initial delivery. Future functionality must say “Em breve”.
Run lint/typecheck/tests at each phase boundary and keep changes in small commits.
