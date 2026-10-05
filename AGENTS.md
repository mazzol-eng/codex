# BotHub contributor guide

## Commands (repository root)

- Install: `pnpm install --frozen-lockfile` (Node >=22.12, pnpm 11.19).
- Services: `docker compose up -d --wait`.
- Database: `pnpm db:generate`; `pnpm db:seed` applies migrations then seeds demo data.
- Run: `pnpm dev` (web port 3000; asynchronous worker).
- Validate: `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- Browser tests: `pnpm test:e2e` (packaged Chromium on Linux; run `pnpm exec playwright install chromium` once on other platforms).
- Production build: `pnpm build`. Format: `pnpm format`.

## Structure

`apps/web` contains the Next.js site and dashboard; `apps/worker` hosts asynchronous jobs.
`packages/db` contains Prisma schema, migrations, seed and tenant-scoped repositories.
`packages/core` contains ports, queue, logging and encryption. `packages/channels` defines
channel contracts and official Telegram/WhatsApp/Twilio plus fake adapters. `packages/flow-engine` is pure TypeScript, with no I/O.
`packages/runtime` composes the engine, tenant persistence, worker processing and realtime ports.
`config/brand.ts` is the only brand/color source. `docs/DECISIONS.md` records tradeoffs.

## Conventions

Strict TypeScript, English code/identifiers and Conventional Commits; pt-BR product copy.
Use existing isolated checkouts; do not create Git worktrees unless explicitly requested.
Keep external services behind ports with fake implementations. Never require real keys for tests.
Never log credentials or message bodies. Persist channel credentials only with AES-256-GCM.
Business reads/writes must be scoped to an authorized workspace, checked server-side.
Never trust a workspace ID or role from client input without checking membership.
Use zod at boundaries, accessible controls, reduced-motion support and centralized tokens.
Phase 3 is authorized by the user's request to continue. Future functionality must say “Em breve”.
Run lint/typecheck/tests at each phase boundary and keep changes in small commits.

- Docker-free development database fallback: `pnpm services:local` in a separate terminal (PostgreSQL 17, loopback only). Never run it beside Compose on port 5432.

- Phase 2 local mode uses the PostgreSQL outbox across web/worker; set QUEUE_MODE=redis for BullMQ/pub-sub.
- Restart web and worker after Prisma generation. Never build into .next while dev is running.
- Connect existing external bots/accounts; never create another Telegram/WhatsApp account for onboarding.
- Codespaces/mobile demo: `.devcontainer` installs pinned dependencies and starts `pnpm demo:cloud`. It supervises local PostgreSQL, idempotent seed, web and worker; port 3000 stays private by default. See `docs/CODESPACES.md`. This is development, not permanent hosting. Creating a Codespace requires separate GitHub account/API access; never equate Git push access with Codespaces permission.
