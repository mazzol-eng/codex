# Architecture

The web application owns server-side authorization, presentation and authentication.
Global users/sessions/accounts are managed by Better Auth. Membership connects an identity
to a workspace. Business data is always scoped by an authorized workspace, never a client role.

PostgreSQL → Prisma repositories → server components / authenticated routes → client charts/forms.
Client state uses TanStack Query; credentials never enter serialized dashboard responses.
Daily metrics are preaggregated; demo seed uses invented values and is labeled in the product.

Core ports isolate queues, e-mail and credentials encryption. BullMQ and an in-memory queue
share QueuePort. FakeEmail and HttpEmail share EmailPort. Channel contracts normalize inbound
and outbound messages; their execution engine/adapters are Phase 2/3 work.

Redis-backed workers and Inbox SSE are designed for Phase 2. The Phase 1 worker is intentionally
idle and consumes no messages. Flow-engine currently defines only graph types.

The database has tenant indexes and compound contact/conversation foreign keys. PostgreSQL RLS
is not enabled in this delivery; see DECISIONS.md. Integration tests use two real workspaces to
verify authorization and query filtering. API responses use no-store for authenticated data.

Local fonts, locally bundled icons, theme variables and brand.ts avoid runtime asset dependencies.
The optional Google provider and real e-mail delivery are the only outbound auth integrations.
