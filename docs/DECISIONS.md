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
