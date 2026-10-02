BEGIN;
-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "draft" JSONB,
ADD COLUMN     "draftRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "connections" ADD COLUMN     "botId" TEXT;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "connectionId" TEXT,
ADD COLUMN     "externalContactId" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "assignedUserId" TEXT,
ADD COLUMN     "connectionId" TEXT,
ADD COLUMN     "lastInboundAt" TIMESTAMP(3),
ADD COLUMN     "session" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "unread" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "versionId" TEXT;

-- CreateTable
CREATE TABLE "flow_versions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "graph" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "externalId" TEXT,
    "idempotencyKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_runs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "trace" JSONB NOT NULL,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flow_versions_workspace_id_id_key" ON "flow_versions"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "flow_versions_workspace_id_botId_number_key" ON "flow_versions"("workspace_id", "botId", "number");

-- CreateIndex
CREATE INDEX "messages_workspace_id_conversationId_createdAt_idx" ON "messages"("workspace_id", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_status_nextAttemptAt_idx" ON "messages"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "messages_workspace_id_idempotencyKey_key" ON "messages"("workspace_id", "idempotencyKey");

-- CreateIndex
CREATE INDEX "webhook_events_status_nextAttemptAt_idx" ON "webhook_events"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_workspace_id_connectionId_externalId_key" ON "webhook_events"("workspace_id", "connectionId", "externalId");

-- CreateIndex
CREATE INDEX "flow_runs_workspace_id_conversationId_createdAt_idx" ON "flow_runs"("workspace_id", "conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "connections_workspace_id_id_key" ON "connections"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_workspace_id_connectionId_externalContactId_key" ON "contacts"("workspace_id", "connectionId", "externalContactId");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_workspace_id_id_key" ON "conversations"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_workspace_id_connectionId_contactId_key" ON "conversations"("workspace_id", "connectionId", "contactId");

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_workspace_id_botId_fkey" FOREIGN KEY ("workspace_id", "botId") REFERENCES "bots"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspace_id_connectionId_fkey" FOREIGN KEY ("workspace_id", "connectionId") REFERENCES "connections"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_connectionId_fkey" FOREIGN KEY ("workspace_id", "connectionId") REFERENCES "connections"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_versionId_fkey" FOREIGN KEY ("workspace_id", "versionId") REFERENCES "flow_versions"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_versions" ADD CONSTRAINT "flow_versions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_versions" ADD CONSTRAINT "flow_versions_workspace_id_botId_fkey" FOREIGN KEY ("workspace_id", "botId") REFERENCES "bots"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_conversationId_fkey" FOREIGN KEY ("workspace_id", "conversationId") REFERENCES "conversations"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_workspace_id_connectionId_fkey" FOREIGN KEY ("workspace_id", "connectionId") REFERENCES "connections"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_runs" ADD CONSTRAINT "flow_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_runs" ADD CONSTRAINT "flow_runs_workspace_id_conversationId_fkey" FOREIGN KEY ("workspace_id", "conversationId") REFERENCES "conversations"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
