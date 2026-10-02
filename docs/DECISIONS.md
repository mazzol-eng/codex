# Decisions

1. Next.js App Router and PostgreSQL are the main runtime. Docker hosts only local PostgreSQL/Redis;
   after dependencies and images are installed, local execution and tests need no Internet.
2. Better Auth is the mature Auth.js equivalent: Prisma-backed sessions, argon2id password hashing,
   optional Google OAuth and its TOTP plugin. Google is hidden without credentials. Fake email is
   the default; the real adapter uses an HTTPS delivery endpoint. TOTP management UI is Phase 5.
3. Latest stable versions are pinned in the lockfile. Prisma's `latest` tag currently points to an
   8.0 release candidate, so use stable 7.10.0 instead. PostgreSQL 17 is the supported baseline.
4. No production authentication shortcut. A demo account is provisioned only by the explicit seed.
   New accounts start with an empty workspace; sample metrics are visibly labeled demo data.
5. Tenant repositories require membership and scope every query. PostgreSQL RLS is evaluated:
   pooled connections and auth's global tables require dedicated roles/transaction context;
   enforcement is deferred, never represented as enabled. Isolation tests cover current boundaries.
6. `workspaceId` Prisma fields map to SQL `workspace_id`. Auth tables are global identities;
   business tables have tenant keys and compound foreign keys where applicable.
7. Fonts are packaged at install time and loaded with next/font/local. No Google Fonts request
   occurs during build or runtime. All fake integration behavior stays server-side.
8. Phase 1 checklist reports real state; channel connection, publication and simulation are
   disabled until Phase 2 rather than simulated as successful.
9. Redis/BullMQ is behind QueuePort. There are no Phase 1 jobs to consume; worker initializes
   without pretending to process messages. Persistent phases 2–4 are intentionally out of scope.

10. Use ESLint 9.39 and TypeScript 6.0 until Next ESLint plugins support the newer major versions; current peer requirements reject ESLint 10 / TypeScript 7.

11. Docker Hub rate limits blocked cloud image pulls. A development-only embedded PostgreSQL 17.9 binary distribution is installed from the npm registry with lockfile integrity checks. `pnpm services:local` uses a real PostgreSQL instance on loopback. Its wrapper has a beta package version and is never a production database dependency. Redis is unnecessary for Phase 1 and QueuePort has an in-memory implementation.

12. next-intl is configured using Next bundler aliases, equivalent to the basic plugin configuration. The current plugin eagerly loads an optional SWC message extractor whose cache fails in this sandbox. No native security or TLS checks are disabled. Core auth/navigation dictionaries have pt-BR and English versions; locale routing and full content translation are future work.
13. Linux browser tests use npm-packaged Chromium, with pnpm integrity verification, so there is no browser download during the test run. Other platforms use the standard Playwright browser install.

14. Pages use a per-request CSP nonce and dynamic rendering so Next framework scripts and the theme initializer are authorized. Style attributes remain permitted for chart/motion components. Development alone allows eval for Next debugging. HTTPS deployment and distributed auth rate limiting are production hardening steps for Phase 5.

15. Queue job IDs are hashed together with the workspace ID, so the same external event ID in two companies cannot suppress another tenant’s job.

16. Phase 2 adds a pure engine with nine node types and eight importable templates. Each bot currently owns one main graph, with multiple prioritized triggers. Multiple named flows, HTTP/AI nodes, A/B splits, business-hour conditions and advanced contact actions remain future work and are identified in the interface.
17. Published versions are append-only: PostgreSQL rejects UPDATE on flow_versions. Restoring copies a version into the draft; publishing creates another row. Sessions hold a tenant-scoped version foreign key until they end. Draft saves use optimistic revisions to prevent overwriting another tab.
18. Inbound events and generated messages are committed transactionally before delivery. A unique workspace/connection/external-event key deduplicates webhooks. Advisory locks serialize processing and human actions for the same contact. Business writes retain workspace filters and composite tenant foreign keys.
19. Redis mode uses BullMQ for inbound dispatch and Redis pub/sub for SSE notifications. The durable PostgreSQL outbox is also polled by the worker, recovering missed queue submissions and serving local development across separate web/worker processes. MemoryQueue remains available for pure tests; local SSE sends invalidations every 1.5 seconds because process-local pub/sub cannot cross that boundary. Redis mode also sends a periodic reauthorization/refresh signal.
20. A pending message is claimed once before sending. Connection/chat send windows are stored in PostgreSQL, so multiple workers respect Telegram limits. Transient failures retry with exponential backoff; an interrupted send with unknown outcome is shown as failed and is not automatically resent. Telegram has no general outbound idempotency key, so a network error after remote acceptance can still be ambiguous; this is not represented as exactly-once external delivery.
21. Scheduled waits and answer timeouts are persisted in session state and dispatch delayed BullMQ jobs in Redis mode. The worker also scans due sessions to recover missed schedules and support local mode. The current scan is bounded at 1,000 open automated sessions per pass; a dedicated indexed scheduling table is needed before operating beyond the initial plan sizes. Telegram is the only real adapter in this phase. WhatsApp/SMS rendering previews and degradation tests do not imply real connections.
22. Connect existing Telegram bots using getMe and setWebhook; do not create new external bots. WhatsApp will connect the user's existing official Business account in Phase 3. No external account, webhook or credential was changed during implementation/testing.
23. Regular-expression triggers use a restricted grammar (no groups, alternatives, backreferences or multiple quantifiers), with pattern/input length bounds. Media URLs require HTTPS. HTTP nodes remain disabled, so they cannot introduce server-side fetch/SSRF in this phase.
