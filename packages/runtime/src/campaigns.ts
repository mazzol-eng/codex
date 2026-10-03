import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '@bothub/db';
import { measureSms, type OutboundMessage } from '@bothub/channels';
import { template, initialState } from '@bothub/flow-engine';
import { writeCsv } from '@bothub/core';
import type { Prisma, Contact } from '../../db/src/generated/client';
import { access, ProductError } from './bots';
import { contactFiltersSchema, contactWhere } from './contacts';
import { templateFingerprint, templateVariables } from './whatsapp-templates';
const contentSchema = z
  .object({
    type: z.enum(['text', 'media', 'buttons', 'list']).default('text'),
    text: z.string().min(1).max(2000),
    mediaUrl: z
      .string()
      .url()
      .max(2000)
      .refine((v) => v.startsWith('https://'))
      .optional(),
    mediaType: z.enum(['image', 'video', 'audio', 'document']).optional(),
    choices: z
      .array(
        z.object({
          id: z.string().regex(/^[a-zA-Z0-9_-]{1,24}$/),
          label: z.string().min(1).max(80),
        }),
      )
      .max(10)
      .optional(),
  })
  .strict();
export const campaignInputSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    connectionId: z.string().min(1).max(80),
    filters: contactFiltersSchema.default({}),
    message: contentSchema,
    templateId: z.string().min(1).max(80).optional(),
    parameters: z.array(z.string().max(300)).max(10).default([]),
  })
  .strict();
export type CampaignInput = z.infer<typeof campaignInputSchema>;
function json(v: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v));
}
export function campaignMessage(
  message: OutboundMessage,
  contact: Pick<Contact, 'name' | 'email' | 'phone' | 'fields'>,
): OutboundMessage {
  const data = {
    ...Object.fromEntries(
      Object.entries(contact.fields as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
    ),
    first_name: contact.name.split(' ')[0] ?? contact.name,
    name: contact.name,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
  };
  const render = (text: string) => {
    if (/\{\{\s*vars\./.test(text))
      throw new ProductError('Campanhas usam variáveis do contato, como {{contact.first_name}}.');
    return template(text, initialState(), data);
  };
  const parameters = message.templateParameters?.map(render);
  return {
    ...message,
    text: message.templateName
      ? message.text.replace(/\{\{(\d+)\}\}/g, (_, n: string) => parameters?.[Number(n) - 1] ?? '')
      : render(message.text),
    ...(parameters ? { templateParameters: parameters } : {}),
  };
}
async function buildAudience(workspaceId: string, input: CampaignInput) {
  const connection = await db.connection.findFirst({
    where: { workspaceId, id: input.connectionId, status: 'connected' },
  });
  if (!connection) throw new ProductError('Escolha uma conexão ativa desta empresa.');
  let selectedTemplate = null;
  let content: OutboundMessage = input.message;
  if (connection.channel === 'whatsapp') {
    selectedTemplate = input.templateId
      ? await db.whatsAppTemplate.findFirst({
          where: {
            workspaceId,
            id: input.templateId,
            connectionId: connection.id,
            status: 'APPROVED',
            supported: true,
          },
        })
      : null;
    if (!selectedTemplate)
      throw new ProductError('WhatsApp usa um template aprovado e compatível.');
    if (templateVariables(selectedTemplate.body) !== input.parameters.length)
      throw new ProductError('Preencha todas as variáveis do template.');
    content = {
      type: 'text',
      text: selectedTemplate.body,
      templateName: selectedTemplate.name,
      templateLanguage: selectedTemplate.language,
      templateParameters: input.parameters,
    };
  } else {
    if (
      connection.channel === 'sms' &&
      (input.message.type !== 'text' || input.message.choices?.length)
    )
      throw new ProductError('Campanhas SMS usam uma mensagem de texto.');
    if (input.message.type === 'media' && !input.message.mediaUrl)
      throw new ProductError('Informe a URL da mídia.');
    if (['buttons', 'list'].includes(input.message.type) && !input.message.choices?.length)
      throw new ProductError('Adicione pelo menos uma opção.');
    if (
      new Set(input.message.choices?.map((c) => c.id)).size !== (input.message.choices?.length ?? 0)
    )
      throw new ProductError('As opções precisam ter identificadores únicos.');
    const suffix = 'Responda PARAR para não receber mais mensagens.';
    content = {
      ...input.message,
      text: input.message.text.endsWith(suffix)
        ? input.message.text
        : `${input.message.text}\n\n${suffix}`,
    };
  }
  const contacts = await db.contact.findMany({
    where: contactWhere(workspaceId, input.filters, connection.id),
    orderBy: { id: 'asc' },
    take: 1001,
  });
  if (contacts.length > 1000)
    throw new ProductError('Use um segmento com até 1.000 contatos por campanha.');
  const recipients = contacts.map((contact) => {
    const reason = !contact.consent
      ? 'opted_out'
      : !contact.marketingConsent
        ? 'no_marketing_consent'
        : !contact.externalContactId
          ? 'missing_address'
          : null;
    const message = reason ? null : campaignMessage(content, contact);
    if (message && message.text.length > 4000)
      throw new ProductError('A mensagem personalizada excede o limite do canal.');
    return {
      contact,
      message,
      reason,
      segments: connection.channel === 'sms' && message ? measureSms(message.text).segments : 0,
    };
  });
  const price = Number((connection.settings as { smsPriceCents?: number }).smsPriceCents ?? 10);
  const eligible = recipients.filter((r) => !r.reason).length;
  const fingerprint = selectedTemplate ? templateFingerprint(selectedTemplate) : null;
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        connectionId: connection.id,
        mode: connection.mode,
        fingerprint,
        content,
        recipients: recipients.map((r) => ({
          id: r.contact.id,
          reason: r.reason,
          message: r.message,
          segments: r.segments,
        })),
        price,
      }),
    )
    .digest('hex');
  return {
    connection,
    content,
    selectedTemplate,
    recipients,
    eligible,
    blocked: recipients.length - eligible,
    total: recipients.length,
    segments: recipients.reduce((n, r) => n + r.segments, 0),
    estimatedCostCents: recipients.reduce((n, r) => n + r.segments * price, 0),
    digest,
    fingerprint,
  };
}
export async function previewCampaign(
  userId: string,
  workspaceId: string,
  value: z.input<typeof campaignInputSchema>,
) {
  await access(userId, workspaceId, true);
  const a = await buildAudience(workspaceId, campaignInputSchema.parse(value));
  return {
    total: a.total,
    eligible: a.eligible,
    blocked: a.blocked,
    segments: a.segments,
    estimatedCostCents: a.estimatedCostCents,
    digest: a.digest,
    mode: a.connection.mode,
    channel: a.connection.channel,
    samples: a.recipients
      .filter((r) => !r.reason)
      .slice(0, 3)
      .map((r) => ({ name: r.contact.name, message: r.message, segments: r.segments })),
  };
}
export async function createCampaign(
  userId: string,
  workspaceId: string,
  value: z.input<typeof campaignInputSchema>,
) {
  await access(userId, workspaceId, true);
  const input = campaignInputSchema.parse(value),
    a = await buildAudience(workspaceId, input);
  return db.campaign.create({
    data: {
      workspaceId,
      connectionId: a.connection.id,
      name: input.name,
      content: json(a.content),
      filters: json(input.filters),
      templateId: a.selectedTemplate?.id,
      templateFingerprint: a.fingerprint,
      estimatedCostCents: a.estimatedCostCents,
    },
  });
}
export async function activateCampaign(
  userId: string,
  workspaceId: string,
  id: string,
  expectedDigest: string,
  scheduledAt?: string,
) {
  await access(userId, workspaceId, true);
  const date = scheduledAt ? new Date(z.string().datetime().parse(scheduledAt)) : new Date();
  if (scheduledAt && date.getTime() < Date.now() + 1000)
    throw new ProductError('Escolha um horário futuro.');
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId + ':campaign:' + id},0))`;
      const c = await tx.campaign.findFirst({ where: { workspaceId, id, status: 'draft' } });
      if (!c) throw new ProductError('Esta campanha já foi iniciada ou não existe.', 409);
      const message = c.content as unknown as OutboundMessage;
      const a = await buildAudience(
        workspaceId,
        campaignInputSchema.parse({
          name: c.name,
          connectionId: c.connectionId,
          filters: c.filters,
          templateId: c.templateId ?? undefined,
          parameters: message.templateParameters ?? [],
          message: {
            type: message.type,
            text: message.text,
            mediaUrl: message.mediaUrl,
            mediaType: message.mediaType,
            choices: message.choices,
          },
        }),
      );
      if (a.digest !== expectedDigest)
        throw new ProductError(
          'O público ou template mudou. Atualize a prévia antes de enviar.',
          409,
        );
      if (!a.eligible)
        throw new ProductError('Nenhum contato tem consentimento para esta campanha.');
      await tx.campaignRecipient.createMany({
        data: a.recipients.map((r) => ({
          workspaceId,
          campaignId: id,
          contactId: r.contact.id,
          status: r.reason ? 'skipped' : 'pending',
          reason: r.reason,
          segments: r.segments,
        })),
      });
      await tx.campaign.updateMany({
        where: { workspaceId, id, status: 'draft' },
        data: { status: 'scheduled', scheduledAt: date, estimatedCostCents: a.estimatedCostCents },
      });
      await tx.auditLog.create({
        data: { workspaceId, actorId: userId, action: 'campaign.scheduled' },
      });
      return {
        id,
        status: 'scheduled',
        scheduledAt: date,
        eligible: a.eligible,
        blocked: a.blocked,
      };
    },
    { timeout: 30000 },
  );
}
export async function cancelCampaign(userId: string, workspaceId: string, id: string) {
  await access(userId, workspaceId, true);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId + ':campaign:' + id},0))`;
    const c = await tx.campaign.findFirst({ where: { workspaceId, id } });
    if (!c) throw new ProductError('Campanha não encontrada.', 404);
    if (c.status === 'completed') throw new ProductError('Esta campanha já terminou.', 409);
    await tx.campaign.updateMany({
      where: { workspaceId, id },
      data: { status: 'cancelled', completedAt: new Date() },
    });
    await tx.campaignRecipient.updateMany({
      where: { workspaceId, campaignId: id, status: 'pending' },
      data: { status: 'skipped', reason: 'campaign_cancelled' },
    });
    await tx.message.updateMany({
      where: { workspaceId, campaignId: id, status: 'pending' },
      data: { status: 'failed', lastError: 'campaign_cancelled' },
    });
    await tx.auditLog.create({
      data: { workspaceId, actorId: userId, action: 'campaign.cancelled' },
    });
    return { cancelled: true };
  });
}
export async function listCampaigns(userId: string, workspaceId: string) {
  await access(userId, workspaceId);
  const items = await db.campaign.findMany({
    where: { workspaceId },
    include: {
      connection: { select: { name: true, channel: true, mode: true } },
      _count: { select: { recipients: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return Promise.all(
    items.map(async (c) => ({ ...c, stats: await campaignStats(workspaceId, c.id) })),
  );
}
async function campaignStats(workspaceId: string, id: string) {
  const [messages, recipients] = await Promise.all([
    db.message.groupBy({
      by: ['status'],
      where: { workspaceId, campaignId: id },
      _count: { _all: true },
    }),
    db.campaignRecipient.groupBy({
      by: ['status'],
      where: { workspaceId, campaignId: id },
      _count: { _all: true },
    }),
  ]);
  const m = Object.fromEntries(messages.map((g) => [g.status, g._count._all])),
    r = Object.fromEntries(recipients.map((g) => [g.status, g._count._all]));
  return {
    total: Object.values(r).reduce((n, v) => n + v, 0),
    sent: (m.sent ?? 0) + (m.delivered ?? 0) + (m.read ?? 0),
    delivered: (m.delivered ?? 0) + (m.read ?? 0),
    read: m.read ?? 0,
    failed: m.failed ?? 0,
    skipped: r.skipped ?? 0,
    pending: (r.pending ?? 0) + (m.pending ?? 0) + (m.sending ?? 0),
  };
}
export async function getCampaign(userId: string, workspaceId: string, id: string) {
  await access(userId, workspaceId);
  const c = await db.campaign.findFirst({
    where: { workspaceId, id },
    include: {
      connection: { select: { name: true, channel: true, mode: true } },
      template: true,
      recipients: {
        orderBy: { createdAt: 'asc' },
        take: 1000,
        include: {
          contact: { select: { name: true, channel: true } },
          message: { select: { status: true, content: true, createdAt: true, lastError: true } },
        },
      },
    },
  });
  if (!c) throw new ProductError('Campanha não encontrada.', 404);
  const replies = c.startedAt
    ? await db.conversation.count({
        where: {
          workspaceId,
          messages: { some: { campaignId: id } },
          AND: {
            messages: {
              some: { workspaceId, direction: 'inbound', createdAt: { gte: c.startedAt } },
            },
          },
        },
      })
    : 0;
  return { ...c, stats: await campaignStats(workspaceId, id), replies };
}
export async function exportCampaign(userId: string, workspaceId: string, id: string) {
  const c = await getCampaign(userId, workspaceId, id);
  return writeCsv(
    ['contato', 'canal', 'status', 'motivo', 'segmentos'],
    c.recipients.map((r) => [
      r.contact.name,
      r.contact.channel,
      r.message?.status ?? r.status,
      r.reason ?? r.message?.lastError,
      r.segments,
    ]),
  );
}
export async function dispatchCampaign(workspaceId: string, id: string, now = Date.now()) {
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId + ':campaign:' + id},0))`;
      const c = await tx.campaign.findFirst({
        where: {
          workspaceId,
          id,
          status: { in: ['scheduled', 'sending'] },
          scheduledAt: { lte: new Date(now) },
        },
        include: { connection: true, template: true },
      });
      if (!c) return;
      await tx.campaign.updateMany({
        where: { workspaceId, id },
        data: { status: 'sending', startedAt: c.startedAt ?? new Date(now) },
      });
      const recipients = await tx.campaignRecipient.findMany({
        where: { workspaceId, campaignId: id, status: 'pending' },
        take: 50,
        orderBy: { createdAt: 'asc' },
        include: { contact: true },
      });
      for (const r of recipients) {
        const contact = r.contact;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId + ':' + c.connectionId + ':' + contact.externalContactId},0))`;
        const fresh = await tx.contact.findFirstOrThrow({ where: { workspaceId, id: contact.id } });
        let reason = !fresh.consent
          ? 'opted_out'
          : !fresh.marketingConsent
            ? 'no_marketing_consent'
            : c.connection.status !== 'connected'
              ? 'connection_unavailable'
              : !fresh.externalContactId
                ? 'missing_address'
                : null;
        if (
          c.connection.channel === 'whatsapp' &&
          (!c.template ||
            c.template.status !== 'APPROVED' ||
            !c.template.supported ||
            templateFingerprint(c.template) !== c.templateFingerprint)
        )
          reason = 'template_unapproved';
        if (reason) {
          await tx.campaignRecipient.updateMany({
            where: { workspaceId, id: r.id },
            data: { status: 'skipped', reason },
          });
          continue;
        }
        const conversation = await tx.conversation.upsert({
          where: {
            workspaceId_connectionId_contactId: {
              workspaceId,
              connectionId: c.connectionId,
              contactId: contact.id,
            },
          },
          create: {
            workspaceId,
            connectionId: c.connectionId,
            contactId: contact.id,
            channel: c.connection.channel,
          },
          update: {},
        });
        const message = await tx.message.create({
          data: {
            workspaceId,
            conversationId: conversation.id,
            campaignId: id,
            sender: 'campaign',
            direction: 'outbound',
            status: 'pending',
            content: json(campaignMessage(c.content as unknown as OutboundMessage, fresh)),
            idempotencyKey: `campaign:${id}:${contact.id}`,
          },
        });
        await tx.campaignRecipient.updateMany({
          where: { workspaceId, id: r.id, status: 'pending' },
          data: { status: 'queued', messageId: message.id },
        });
      }
      const remaining = await tx.campaignRecipient.count({
          where: { workspaceId, campaignId: id, status: 'pending' },
        }),
        queued = await tx.message.count({
          where: { workspaceId, campaignId: id, status: { in: ['pending', 'sending'] } },
        });
      if (!remaining && !queued)
        await tx.campaign.updateMany({
          where: { workspaceId, id },
          data: { status: 'completed', completedAt: new Date(now) },
        });
    },
    { timeout: 30000 },
  );
}
export async function processDueCampaigns() {
  const campaigns = await db.campaign.findMany({
    where: { status: { in: ['scheduled', 'sending'] }, scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: 'asc' },
    take: 10,
    select: { id: true, workspaceId: true },
  });
  for (const c of campaigns) await dispatchCampaign(c.workspaceId, c.id);
}
