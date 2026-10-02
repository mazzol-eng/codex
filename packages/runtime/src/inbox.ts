import { db, authorizeWorkspace, AccessDenied } from '@bothub/db';
import { access, ProductError } from './bots';
import { sessionState } from './processing';
import { notify } from './realtime';
import type { Prisma } from '../../db/src/generated/client';
export async function listConversations(userId: string, workspaceId: string) {
  await access(userId, workspaceId);
  return db.conversation.findMany({
    where: { workspaceId },
    include: {
      contact: { select: { id: true, name: true, channel: true, consent: true, tags: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, direction: true, createdAt: true },
      },
      connection: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
}
export async function getConversation(userId: string, workspaceId: string, id: string) {
  await access(userId, workspaceId);
  const conv = await db.conversation.findFirst({
    where: { workspaceId, id },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          channel: true,
          consent: true,
          tags: true,
          consentSource: true,
          consentAt: true,
        },
      },
      connection: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 200 },
      runs: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!conv) throw new ProductError('Conversa não encontrada.', 404);
  return { ...conv, messages: conv.messages.reverse() };
}
export async function actOnConversation(
  userId: string,
  workspaceId: string,
  id: string,
  input: { action: 'take' | 'return' | 'close' | 'reply' | 'note' | 'read'; text?: string },
) {
  const membership = await authorizeWorkspace(userId, workspaceId);
  if (membership.role === 'viewer') throw new AccessDenied();
  await db.$transaction(async (tx) => {
    const initial = await tx.conversation.findFirst({
      where: { workspaceId, id },
      include: { contact: true },
    });
    if (!initial) throw new ProductError('Conversa não encontrada.', 404);
    const lock =
      initial.connectionId && initial.contact.externalContactId
        ? `${workspaceId}:${initial.connectionId}:${initial.contact.externalContactId}`
        : `${workspaceId}:inbox:${id}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock},0))`;
    const c = await tx.conversation.findFirst({
      where: { workspaceId, id },
      include: { contact: true },
    });
    if (!c) throw new ProductError('Conversa não encontrada.', 404);
    const state = sessionState(c.session);
    if (input.action === 'read') {
      await tx.conversation.updateMany({ where: { workspaceId, id }, data: { unread: 0 } });
      return;
    }
    if (
      ['take', 'reply', 'note', 'return', 'close'].includes(input.action) &&
      c.assignedUserId &&
      c.assignedUserId !== userId &&
      !['owner', 'admin'].includes(membership.role)
    )
      throw new ProductError('Esta conversa está com outra pessoa.', 409);
    if (input.action === 'take') {
      state.mode = 'human';
      const pending = await tx.message.findMany({
        where: {
          workspaceId,
          conversationId: id,
          direction: 'outbound',
          sender: 'bot',
          status: 'pending',
        },
        select: { id: true, content: true },
      });
      const cancelIds = pending
        .filter((m) => (m.content as { purpose?: string }).purpose !== 'optout_confirmation')
        .map((m) => m.id);
      await tx.message.updateMany({
        where: { workspaceId, conversationId: id, id: { in: cancelIds } },
        data: { status: 'failed', lastError: 'human_takeover' },
      });
      await tx.conversation.updateMany({
        where: { workspaceId, id },
        data: {
          mode: 'human',
          assignedUserId: userId,
          status: 'open',
          session: state as unknown as Prisma.InputJsonValue,
        },
      });
    } else if (input.action === 'return') {
      state.mode = 'bot';
      await tx.conversation.updateMany({
        where: { workspaceId, id },
        data: {
          mode: 'bot',
          assignedUserId: null,
          session: state as unknown as Prisma.InputJsonValue,
        },
      });
    } else if (input.action === 'close')
      await tx.conversation.updateMany({
        where: { workspaceId, id },
        data: { status: 'closed', unread: 0 },
      });
    else {
      if (!input.text?.trim()) throw new ProductError('Escreva uma mensagem.');
      if (input.action === 'reply') {
        if (c.mode !== 'human')
          throw new ProductError('Assuma a conversa antes de responder.', 409);
        if (!c.contact.consent)
          throw new ProductError('Este contato pediu para não receber mensagens.', 409);
        if (!c.connectionId)
          throw new ProductError('Esta conversa é ilustrativa e não tem canal conectado.', 409);
        if (
          c.channel === 'whatsapp' &&
          (!c.lastInboundAt || Date.now() - c.lastInboundAt.getTime() > 86400000)
        )
          throw new ProductError(
            'A janela de 24h terminou. Use um template aprovado na Fase 3.',
            409,
          );
      }
      await tx.message.create({
        data: {
          workspaceId,
          conversationId: id,
          direction: input.action === 'note' ? 'note' : 'outbound',
          sender: 'human',
          content: { type: 'text', text: input.text },
          status: input.action === 'note' ? 'internal' : 'pending',
        },
      });
      await tx.conversation.updateMany({
        where: { workspaceId, id },
        data: { updatedAt: new Date() },
      });
    }
    await tx.auditLog.create({
      data: { workspaceId, actorId: userId, action: `conversation.${input.action}` },
    });
  });
  await notify(workspaceId);
  return { ok: true };
}
