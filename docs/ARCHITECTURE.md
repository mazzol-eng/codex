# Architecture

The web application owns server-side authorization, presentation and authentication.
Global users/sessions/accounts are managed by Better Auth. Membership connects an identity
to a workspace. Business data is always scoped by an authorized workspace, never a client role.

PostgreSQL → Prisma repositories → server components / authenticated routes → client charts/forms.
Client state uses TanStack Query; credentials never enter serialized dashboard responses.
Daily metrics are preaggregated; demo seed uses invented values and is labeled in the product.

Core ports isolate queues, e-mail and credentials encryption. BullMQ and an in-memory queue
share QueuePort. FakeEmail and HttpEmail share EmailPort. Channel contracts normalize inbound
and outbound messages; flow-engine and Telegram/Simulator adapters are implemented. Official WhatsApp Cloud API and Twilio SMS adapters share these contracts; each has a fake transport.

The worker executes inbound events, resumes waits and sends persisted outbound messages.
Inbox receives tenant-scoped invalidations over SSE. See the Phase 2 execution section below.

The database has tenant indexes and compound contact/conversation foreign keys. PostgreSQL RLS
is not enabled in this delivery; see DECISIONS.md. Integration tests use two real workspaces to
verify authorization and query filtering. API responses use no-store for authenticated data.

Local fonts, locally bundled icons, theme variables and brand.ts avoid runtime asset dependencies.
The optional Google provider and real e-mail delivery are the only outbound auth integrations.

## Phase 2 execution

packages/runtime composes pure flow-engine, channel adapters and tenant-scoped persistence. The web API authorizes members and validates bodies/origins; the worker has service access, enumerates pending jobs globally, then scopes every business operation to that job's workspace.

Incoming webhook → verify secret → normalized event / durable outbox → async worker transaction → pinned FlowVersion and Conversation session → persisted outbound Messages → rate-limited sender. FlowRun stores node IDs/status/error codes; application logs never contain message text, tokens or contacts. Published rows cannot be updated at the database layer.

Redis mode uses BullMQ dispatch and Redis pub/sub invalidations consumed by the web SSE route. The database outbox also recovers missed dispatches. Local mode uses durable polling, with memory ports for unit tests and periodic SSE invalidation across processes. SSE rechecks session/membership and sends no message contents; authorized queries fetch the current view.

Human actions and inbound processing share a contact lock; taking a conversation cancels pending bot replies. Compound tenant foreign keys cover bots, versions, connections, contacts, conversations and messages. A viewer cannot edit flows or reply. Bot configuration requires owner/admin; attendants operate Inbox. Invitation UI and the full permission matrix remain Phase 4.

## Phase 3 execution

Connections distinguish real and fake mode. The browser receives only safe metadata, never ciphertext, verification hashes or credentials. A globally unique channel/external-account pair prevents sharing an external account across tenants. All new business tables use workspace IDs and compound tenant foreign keys.

WhatsApp challenge verification finds the connection through a SHA-256 verify-token hash; signed POSTs route through phone_number_id and validate HMAC-SHA256 before persistence. Twilio signs the configured public URL plus sorted form parameters with HMAC-SHA1. The API accepts the signature only for real connections. Status receipts are durable, deduplicated jobs and update outbound delivery monotonically without creating inbound contacts.

CRM contacts are scoped to a connection. Conversation and marketing consent are separate, with source, timestamp and append-only audit records. CSV is validated before any write, uses explicit column mapping and an atomic limit check, and cannot re-enable existing opt-outs. Exported cells are quoted and spreadsheet formula prefixes are escaped. Segments store a validated filter definition, not arbitrary queries.

Campaigns start as drafts. Preview renders contact variables safely, calculates the eligible audience and SMS cost, and signs the reviewed snapshot with a SHA-256 digest. Activation rejects changed audiences/templates and persists recipient rows. The scheduler claims due campaigns, dispatches batches of 50 and checks consent again. The sender repeats consent, campaign cancellation, approved-template and WhatsApp window checks immediately before claiming a message. Outbound messages retain a campaign ID for delivery reports.

Campaigns have a 1,000-contact limit per send and CSV imports have a 1,000-row / 200 KB limit. These are bounded initial workflows, not a scale claim. Approximate responses count conversations with an inbound message after campaign start; they do not imply causal attribution. SMS price is configurable per connection and estimated, not a live provider quote. Fake sends are labeled in the interface and reports.
