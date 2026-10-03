BEGIN;
-- AlterTable
ALTER TABLE "connections" ADD COLUMN     "externalAccountId" TEXT,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'real',
ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "verificationHash" TEXT;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "email" TEXT,
ADD COLUMN     "fields" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "marketingAt" TIMESTAMP(3),
ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketingSource" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "campaignId" TEXT;

-- CreateTable
CREATE TABLE "segments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pt_BR',
    "category" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "supported" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "content" JSONB NOT NULL,
    "filters" JSONB NOT NULL,
    "templateId" TEXT,
    "templateFingerprint" TEXT,
    "estimatedCostCents" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "segments" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "segments_workspace_id_id_key" ON "segments"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "segments_workspace_id_name_key" ON "segments"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "consent_records_workspace_id_contactId_createdAt_idx" ON "consent_records"("workspace_id", "contactId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_workspace_id_id_key" ON "whatsapp_templates"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_workspace_id_connectionId_name_language_key" ON "whatsapp_templates"("workspace_id", "connectionId", "name", "language");

-- CreateIndex
CREATE INDEX "campaigns_status_scheduledAt_idx" ON "campaigns"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_workspace_id_id_key" ON "campaigns"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "campaign_recipients_workspace_id_campaignId_status_idx" ON "campaign_recipients"("workspace_id", "campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_recipients_workspace_id_campaignId_contactId_key" ON "campaign_recipients"("workspace_id", "campaignId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "connections_verificationHash_key" ON "connections"("verificationHash");

-- CreateIndex
CREATE UNIQUE INDEX "connections_channel_externalAccountId_key" ON "connections"("channel", "externalAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "messages_workspace_id_id_key" ON "messages"("workspace_id", "id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_campaignId_fkey" FOREIGN KEY ("workspace_id", "campaignId") REFERENCES "campaigns"("workspace_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_workspace_id_contactId_fkey" FOREIGN KEY ("workspace_id", "contactId") REFERENCES "contacts"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_workspace_id_connectionId_fkey" FOREIGN KEY ("workspace_id", "connectionId") REFERENCES "connections"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_connectionId_fkey" FOREIGN KEY ("workspace_id", "connectionId") REFERENCES "connections"("workspace_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_templateId_fkey" FOREIGN KEY ("workspace_id", "templateId") REFERENCES "whatsapp_templates"("workspace_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_workspace_id_campaignId_fkey" FOREIGN KEY ("workspace_id", "campaignId") REFERENCES "campaigns"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_workspace_id_contactId_fkey" FOREIGN KEY ("workspace_id", "contactId") REFERENCES "contacts"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_workspace_id_messageId_fkey" FOREIGN KEY ("workspace_id", "messageId") REFERENCES "messages"("workspace_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT;
