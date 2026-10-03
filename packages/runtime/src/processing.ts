import { db } from '@bothub/db';
import { BullQueue, MemoryQueue, type QueuePort } from '@bothub/core';
import {
  graphSchema,
  runFlow,
  initialState,
  type SessionState,
  type EngineResult,
} from '@bothub/flow-engine';
import { createHash } from 'node:crypto';
import type { InboundEvent, OutboundMessage, ChannelStatus } from '@bothub/channels';
import { ChannelError } from '@bothub/channels/adapters';
import type { Prisma } from '../../db/src/generated/client';
import { adapterFor, type AdapterTransports } from './connections';
import { notify } from './realtime';
import { ProductError } from './bots';
import { templateFingerprint } from './whatsapp-templates';
let queue: QueuePort | undefined;
export function getQueue() {
  return (queue ??=
    process.env.QUEUE_MODE === 'redis'
      ? new BullQueue(process.env.REDIS_URL ?? 'redis://localhost:6379')
      : new MemoryQueue());
}
function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
export function sessionState(value: unknown): SessionState {
  const input = value as Partial<SessionState> | null;
  return {
    ...initialState(),
    ...(input && typeof input === 'object' ? input : {}),
    variables: input?.variables ?? {},
    tags: input?.tags ?? [],
  };
}
export async function ingest(connection: { id: string; workspaceId: string }, event: InboundEvent) {
  const saved = await db.webhookEvent.upsert({
    where: {
      workspaceId_connectionId_externalId: {
        workspaceId: connection.workspaceId,
        connectionId: connection.id,
        externalId: event.externalMessageId,
      },
    },
    create: {
      workspaceId: connection.workspaceId,
      connectionId: connection.id,
      externalId: event.externalMessageId,
      payload: json(event),
    },
    update: {},
  });
  // Database is the durable outbox if queue enqueue fails or the process restarts.
  if (saved.status === 'pending' && process.env.QUEUE_MODE === 'redis')
    void getQueue()
      .enqueue(saved.id, {
        workspaceId: connection.workspaceId,
        type: 'inbound',
        data: { eventId: saved.id },
      })
      .catch(() => {});
  return saved;
}
export async function ingestStatus(
  connection: { id: string; workspaceId: string },
  status: ChannelStatus,
) {
  const externalId = `status:${createHash('sha256').update(`${status.externalMessageId}:${status.status}`).digest('hex')}`;
  return db.webhookEvent.upsert({
    where: {
      workspaceId_connectionId_externalId: {
        workspaceId: connection.workspaceId,
        connectionId: connection.id,
        externalId,
      },
    },
    create: {
      workspaceId: connection.workspaceId,
      connectionId: connection.id,
      externalId,
      payload: json({ kind: 'status', ...status }),
    },
    update: {},
  });
}
async function storeResult(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  conversationId: string,
  result: EngineResult,
) {
  await tx.flowRun.create({
    data: { workspaceId, conversationId, trace: json(result.trace), errors: result.errors },
  });
  for (const action of result.actions) {
    if (action.type === 'send')
      await tx.message.create({
        data: {
          workspaceId,
          conversationId,
          direction: 'outbound',
          kind: action.message.type,
          content: json(action.message),
          status: 'pending',
        },
      });
    if (action.type === 'consent') {
      const conv = await tx.conversation.findFirstOrThrow({
        where: { workspaceId, id: conversationId },
      });
      await tx.contact.updateMany({
        where: { workspaceId, id: conv.contactId },
        data: {
          consent: action.value,
          consentAt: new Date(),
          consentSource: 'opt-out por mensagem',
          marketingConsent: false,
          marketingAt: new Date(),
          marketingSource: 'opt-out por mensagem',
        },
      });
      await tx.consentRecord.create({
        data: {
          workspaceId,
          contactId: conv.contactId,
          scope: 'all',
          granted: false,
          source: 'opt-out por mensagem',
        },
      });
    }
  }
}
async function incrementMetric(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  channel: string,
  counters: {
    sent?: number;
    received?: number;
    newContacts?: number;
    started?: number;
    completed?: number;
  },
) {
  const workspace = await tx.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { timeZone: true },
  });
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: workspace.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const date = new Date(`${dateKey}T00:00:00Z`);
  const update = Object.fromEntries(
    Object.entries(counters).map(([key, value]) => [key, { increment: value }]),
  );
  await tx.dailyMetric.upsert({
    where: { workspaceId_date_channel: { workspaceId, date, channel } },
    create: { workspaceId, date, channel, ...counters },
    update,
  });
}
export async function processEvent(
  workspaceId: string,
  eventId: string,
  transport?: AdapterTransports,
) {
  let scheduled: { conversationId: string; expiresAt: number } | undefined;
  let callback: InboundEvent | undefined;
  let callbackConnection: { channel: string; credentialCiphertext: string | null } | undefined;
  await db.$transaction(
    async (tx) => {
      const initial = await tx.webhookEvent.findFirst({
        where: { workspaceId, id: eventId, status: 'pending' },
      });
      if (!initial) return;
      const receipt = initial.payload as unknown as ChannelStatus & { kind?: string };
      if (receipt.kind === 'status') {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId + ':receipt:' + initial.connectionId + ':' + receipt.externalMessageId},0))`;
        if (
          !(await tx.webhookEvent.findFirst({
            where: { workspaceId, id: eventId, status: 'pending' },
          }))
        )
          return;
        const m = await tx.message.findFirst({
          where: {
            workspaceId,
            externalId: receipt.externalMessageId,
            direction: 'outbound',
            conversation: { connectionId: initial.connectionId },
          },
        });
        if (!m) throw new ProductError('Recibo aguardando mensagem.', 409);
        const ranks: Record<string, number> = { sent: 1, delivered: 2, read: 3 };
        if (
          (receipt.status === 'failed' && !['delivered', 'read'].includes(m.status)) ||
          (ranks[receipt.status] ?? 0) > (ranks[m.status] ?? 0)
        )
          await tx.message.updateMany({
            where: { workspaceId, id: m.id },
            data: {
              status: receipt.status,
              lastError: receipt.status === 'failed' ? 'provider_delivery_failed' : null,
            },
          });
        await tx.webhookEvent.updateMany({
          where: { workspaceId, id: eventId },
          data: { status: 'processed', lastError: null },
        });
        return;
      }
      const event = initial.payload as unknown as InboundEvent;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId + ':' + initial.connectionId + ':' + event.externalContactId}, 0))`;
      const record = await tx.webhookEvent.findFirst({
        where: { workspaceId, id: eventId, status: 'pending', nextAttemptAt: { lte: new Date() } },
      });
      if (!record) return;
      const oldest = await tx.webhookEvent.findFirst({
        where: {
          workspaceId,
          connectionId: initial.connectionId,
          status: 'pending',
          payload: { path: ['externalContactId'], equals: event.externalContactId },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      if (oldest?.id !== eventId) return;
      const connection = await tx.connection.findFirstOrThrow({
        where: { workspaceId, id: record.connectionId },
        include: { bot: true },
      });
      if (event.callbackQueryId) {
        callback = event;
        callbackConnection = connection;
      }
      const existingContact = await tx.contact.findFirst({
        where: {
          workspaceId,
          connectionId: connection.id,
          externalContactId: event.externalContactId,
        },
        select: { id: true },
      });
      const contact = await tx.contact.upsert({
        where: {
          workspaceId_connectionId_externalContactId: {
            workspaceId,
            connectionId: connection.id,
            externalContactId: event.externalContactId,
          },
        },
        create: {
          workspaceId,
          connectionId: connection.id,
          externalContactId: event.externalContactId,
          name: event.contactName ?? 'Cliente',
          channel: connection.channel,
          phone: ['whatsapp', 'sms'].includes(connection.channel)
            ? `${event.externalContactId.startsWith('+') ? '' : '+'}${event.externalContactId}`
            : undefined,
          consent: true,
          consentAt: new Date(),
          consentSource: 'conversa iniciada pelo contato',
        },
        update: {},
      });
      let conversation = await tx.conversation.upsert({
        where: {
          workspaceId_connectionId_contactId: {
            workspaceId,
            connectionId: connection.id,
            contactId: contact.id,
          },
        },
        create: {
          workspaceId,
          connectionId: connection.id,
          contactId: contact.id,
          channel: connection.channel,
        },
        update: {},
      });
      const isResume = event.externalMessageId.startsWith('resume:');
      if (!isResume) {
        await tx.message.create({
          data: {
            workspaceId,
            conversationId: conversation.id,
            direction: 'inbound',
            content: json({
              text:
                event.text ??
                (event.type === 'button_reply'
                  ? String(event.payload ?? '')
                  : 'Mensagem com mídia ou localização'),
              type: event.type,
              payload: event.payload,
            }),
            idempotencyKey: `${connection.id}:${event.externalMessageId}`,
          },
        });
        conversation = await tx.conversation.update({
          where: { workspaceId_id: { workspaceId, id: conversation.id } },
          data: {
            status: 'open',
            lastInboundAt: new Date(event.timestamp),
            unread: { increment: 1 },
          },
        });
      }
      let state = sessionState(conversation.session);
      state.mode = conversation.mode === 'human' ? 'human' : 'bot';
      state.optedOut = !contact.consent;
      state.tags = [...contact.tags];
      let version = conversation.versionId
        ? await tx.flowVersion.findFirst({ where: { workspaceId, id: conversation.versionId } })
        : null;
      if (
        (!version || (state.ended && !state.waiting && state.mode === 'bot')) &&
        connection.botId &&
        !isResume
      ) {
        version = await tx.flowVersion.findFirst({
          where: { workspaceId, botId: connection.botId },
          orderBy: { number: 'desc' },
        });
      }
      const isOptOut = /^(PARAR|SAIR|STOP|CANCELAR)$/i.test(event.text?.trim() ?? '');
      const wasWaiting = !!state.waiting;
      let result: EngineResult | undefined;
      if (version && (connection.bot?.status === 'active' || isOptOut)) {
        result = runFlow(graphSchema.parse(version.graph), state, event, {
          now: Date.now(),
          contact: {
            ...Object.fromEntries(
              Object.entries(contact.fields as Record<string, unknown>).map(([key, value]) => [
                key,
                String(value),
              ]),
            ),
            first_name: contact.name.split(' ')[0] ?? contact.name,
            email: contact.email ?? '',
            phone: contact.phone ?? '',
          },
          lastInboundAt: conversation.lastInboundAt?.getTime(),
        });
      } else if (isOptOut) {
        result = runFlow(
          {
            nodes: [{ id: 'end', type: 'end', data: {} }],
            edges: [],
            triggers: [{ type: 'first_message', priority: 0, nodeId: 'end' }],
          },
          state,
          event,
        );
      }
      if (result) {
        state = result.state;
        await storeResult(tx, workspaceId, conversation.id, result);
        if (
          !result.actions.length &&
          !result.trace.length &&
          !isResume &&
          state.mode === 'bot' &&
          !state.optedOut &&
          connection.bot?.status === 'active'
        ) {
          const settings = connection.bot.settings as Record<string, unknown>;
          await tx.message.create({
            data: {
              workspaceId,
              conversationId: conversation.id,
              direction: 'outbound',
              status: 'pending',
              content: {
                type: 'text',
                text:
                  typeof settings.fallback === 'string'
                    ? settings.fallback
                    : 'Não entendi. Envie /start para começar uma nova conversa.',
              },
            },
          });
        }
      }
      await tx.conversation.updateMany({
        where: { workspaceId, id: conversation.id },
        data: { session: json(state), versionId: version?.id, mode: state.mode },
      });
      if (state.waiting?.expiresAt)
        scheduled = { conversationId: conversation.id, expiresAt: state.waiting.expiresAt };
      await tx.contact.updateMany({
        where: { workspaceId, id: contact.id },
        data: { tags: state.tags },
      });
      await incrementMetric(tx, workspaceId, connection.channel, {
        received: isResume ? 0 : 1,
        newContacts: existingContact ? 0 : 1,
        started: result?.trace.length && !wasWaiting ? 1 : 0,
        completed: result?.trace.some(
          (t) =>
            graphSchema.parse(version?.graph).nodes.find((n) => n.id === t.nodeId)?.type === 'end',
        )
          ? 1
          : 0,
      });
      await tx.webhookEvent.updateMany({
        where: { workspaceId, id: eventId },
        data: { status: 'processed', lastError: null },
      });
    },
    { timeout: 10000 },
  );
  if (scheduled && process.env.QUEUE_MODE === 'redis')
    void getQueue()
      .enqueue(
        `resume:${scheduled.conversationId}:${scheduled.expiresAt}`,
        { workspaceId, type: 'resume', data: { conversationId: scheduled.conversationId } },
        Math.max(0, scheduled.expiresAt - Date.now()),
      )
      .catch(() => {});
  if (callback && callbackConnection)
    await adapterFor(callbackConnection, transport)
      .acknowledge?.(callback)
      .catch(() => {});
  await notify(workspaceId);
}
export async function sendPending(
  messageId: string,
  workspaceId: string,
  transport?: AdapterTransports,
  now = Date.now(),
) {
  const message = await db.message.findFirst({
    where: { workspaceId, id: messageId, status: 'pending', nextAttemptAt: { lte: new Date(now) } },
    include: { conversation: { include: { connection: true, contact: true } } },
  });
  if (!message) return;
  const { connection, contact } = message.conversation;
  if (!connection || !contact.externalContactId) {
    await db.message.updateMany({
      where: { workspaceId, id: message.id },
      data: { status: 'failed', lastError: 'connection_unavailable' },
    });
    return;
  }
  const content = message.content as unknown as OutboundMessage;
  const claimed = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId + ':send:' + connection.id},0))`;
    const freshConnection = await tx.connection.findFirstOrThrow({
      where: { workspaceId, id: connection.id },
    });
    const freshContact = await tx.contact.findFirstOrThrow({
      where: { workspaceId, id: contact.id },
    });
    if (!freshContact.consent && content.purpose !== 'optout_confirmation') {
      await tx.message.updateMany({
        where: { workspaceId, id: messageId, status: 'pending' },
        data: { status: 'failed', lastError: 'contact_opted_out' },
      });
      return false;
    }
    let blocked: string | undefined;
    if (!['connected', 'pending', 'fixture'].includes(freshConnection.status))
      blocked = 'connection_unavailable';
    if (message.campaignId) {
      const campaign = await tx.campaign.findFirst({
        where: { workspaceId, id: message.campaignId },
        include: { template: true },
      });
      if (!campaign || !['scheduled', 'sending'].includes(campaign.status))
        blocked = 'campaign_cancelled';
      else if (!freshContact.marketingConsent) blocked = 'no_marketing_consent';
      else if (
        connection.channel === 'whatsapp' &&
        (!campaign.template ||
          campaign.template.status !== 'APPROVED' ||
          !campaign.template.supported ||
          templateFingerprint(campaign.template) !== campaign.templateFingerprint)
      )
        blocked = 'template_unapproved';
    }
    if (connection.channel === 'whatsapp' && !content.templateName) {
      const conversation = await tx.conversation.findFirstOrThrow({
        where: { workspaceId, id: message.conversationId },
      });
      if (!conversation.lastInboundAt || now - conversation.lastInboundAt.getTime() >= 86400000)
        blocked = 'whatsapp_window_expired';
    }
    if (blocked) {
      await tx.message.updateMany({
        where: { workspaceId, id: messageId, status: 'pending' },
        data: { status: 'failed', lastError: blocked },
      });
      return false;
    }
    const oldest = await tx.message.findFirst({
      where: {
        workspaceId,
        conversationId: message.conversationId,
        status: { in: ['pending', 'sending'] },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (oldest?.id !== messageId) return false;
    if (
      connection.channel !== 'simulator' &&
      (freshConnection.nextSendAt.getTime() > now || freshContact.nextSendAt.getTime() > now)
    )
      return false;
    const claim = await tx.message.updateMany({
      where: { workspaceId, id: messageId, status: 'pending' },
      data: { status: 'sending', attempts: { increment: 1 } },
    });
    if (!claim.count) return false;
    if (connection.channel !== 'simulator') {
      await tx.connection.updateMany({
        where: { workspaceId, id: connection.id },
        data: {
          nextSendAt: new Date(
            now +
              (connection.channel === 'telegram' ? 34 : connection.channel === 'sms' ? 1000 : 100),
          ),
        },
      });
      await tx.contact.updateMany({
        where: { workspaceId, id: contact.id },
        data: { nextSendAt: new Date(now + (connection.channel === 'whatsapp' ? 6000 : 1000)) },
      });
    }
    return true;
  });
  if (!claimed) return;
  try {
    const sent = await adapterFor(connection, transport).send(
      contact.externalContactId,
      message.content as unknown as OutboundMessage,
    );
    try {
      await db.$transaction(async (tx) => {
        const marked = await tx.message.updateMany({
          where: { workspaceId, id: message.id, status: 'sending' },
          data: { status: sent.status, externalId: sent.externalId, lastError: null },
        });
        if (marked.count && sent.status === 'sent')
          await incrementMetric(tx, workspaceId, connection.channel, { sent: 1 });
      });
    } catch {
      await db.message.updateMany({
        where: { workspaceId, id: message.id, status: 'sending' },
        data: { status: 'failed', lastError: 'delivery_outcome_unknown' },
      });
    }
  } catch (error) {
    const code = error instanceof ChannelError ? error.code : 'delivery_failed';
    const attempts = message.attempts + 1;
    const retryable =
      code === 'rate_limited' || code === 'network_failure' || code === 'delivery_failed';
    await db.message.updateMany({
      where: { workspaceId, id: message.id },
      data: {
        status: retryable && attempts < 5 ? 'pending' : 'failed',
        lastError: code,
        nextAttemptAt: new Date(
          now +
            Math.max(
              error instanceof ChannelError ? (error.retryAfter ?? 0) * 1000 : 0,
              1000 * 2 ** attempts,
            ),
        ),
      },
    });
  }
  await notify(workspaceId);
}
export async function enqueueConversationResume(workspaceId: string, conversationId: string) {
  const c = await db.conversation.findFirst({
    where: {
      workspaceId,
      id: conversationId,
      mode: 'bot',
      status: 'open',
      connectionId: { not: null },
      versionId: { not: null },
      connection: { bot: { status: 'active' } },
    },
    include: { contact: { select: { externalContactId: true } } },
  });
  if (!c?.contact.externalContactId) return;
  const state = sessionState(c.session);
  if (!state.waiting?.expiresAt || state.waiting.expiresAt > Date.now()) return;
  await ingest(
    { id: c.connectionId!, workspaceId },
    {
      channel: c.channel as InboundEvent['channel'],
      connectionId: c.connectionId!,
      externalContactId: c.contact.externalContactId,
      externalMessageId: `resume:${c.id}:${state.waiting.expiresAt}`,
      type: 'text',
      timestamp: new Date().toISOString(),
    },
  );
}
export async function enqueueDueSessions() {
  const conversations = await db.conversation.findMany({
    where: {
      mode: 'bot',
      connectionId: { not: null },
      versionId: { not: null },
      status: 'open',
      connection: { bot: { status: 'active' } },
    },
    take: 1000,
    orderBy: { updatedAt: 'asc' },
    select: { id: true, workspaceId: true, session: true },
  });
  for (const c of conversations) {
    const state = sessionState(c.session);
    if (state.waiting?.expiresAt && state.waiting.expiresAt <= Date.now())
      await enqueueConversationResume(c.workspaceId, c.id);
  }
}
export async function processPending() {
  const events = await db.webhookEvent.findMany({
    where: {
      status: 'pending',
      nextAttemptAt: { lte: new Date() },
      connection: { status: { in: ['connected', 'pending'] } },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { id: true, workspaceId: true, attempts: true },
  });
  for (const e of events)
    try {
      await processEvent(e.workspaceId, e.id);
    } catch {
      const attempts = e.attempts + 1;
      await db.webhookEvent.updateMany({
        where: { workspaceId: e.workspaceId, id: e.id, status: 'pending' },
        data: {
          attempts,
          lastError: 'processing_failed',
          status: attempts >= 5 ? 'failed' : 'pending',
          nextAttemptAt: new Date(Date.now() + 1000 * 2 ** attempts),
        },
      });
    }
  const messages = await db.message.findMany({
    where: {
      status: 'pending',
      nextAttemptAt: { lte: new Date() },
      conversation: { connection: { status: { in: ['connected', 'pending'] } } },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
    select: { id: true, workspaceId: true },
  });
  for (const m of messages) await sendPending(m.id, m.workspaceId);
  // An interrupted external send has an unknown outcome: do not silently resend it.
  await db.message.updateMany({
    where: { status: 'sending', updatedAt: { lt: new Date(Date.now() - 60000) } },
    data: { status: 'failed', lastError: 'delivery_outcome_unknown' },
  });
}
