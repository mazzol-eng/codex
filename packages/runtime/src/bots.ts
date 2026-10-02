import { db, authorizeWorkspace, AccessDenied } from '@bothub/db';
import {
  blankGraph,
  botTemplates,
  graphSchema,
  validateGraph,
  type FlowGraph,
} from '@bothub/flow-engine';
import type { Prisma } from '../../db/src/generated/client';
export class ProductError extends Error {
  constructor(
    public message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function access(userId: string, workspaceId: string, write = false) {
  const m = await authorizeWorkspace(userId, workspaceId);
  if (write && !['owner', 'admin'].includes(m.role)) throw new AccessDenied();
  return m;
}
export async function listBots(userId: string, workspaceId: string) {
  await access(userId, workspaceId);
  return db.bot.findMany({
    where: { workspaceId, status: { not: 'archived' } },
    include: {
      versions: {
        orderBy: { number: 'desc' },
        take: 1,
        select: { id: true, number: true, createdAt: true },
      },
      connections: { select: { id: true, channel: true, name: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
export async function getBot(userId: string, workspaceId: string, id: string) {
  await access(userId, workspaceId);
  const bot = await db.bot.findFirst({
    where: { workspaceId, id },
    include: {
      versions: {
        orderBy: { number: 'desc' },
        select: { id: true, number: true, createdAt: true },
      },
      connections: { select: { id: true, name: true, channel: true, status: true } },
    },
  });
  if (!bot) throw new ProductError('Bot não encontrado.', 404);
  return { ...bot, draft: bot.draft ?? blankGraph() };
}
export async function createBot(
  userId: string,
  workspaceId: string,
  input: { name: string; templateId?: string; duplicateId?: string },
) {
  await access(userId, workspaceId, true);
  const selected = input.templateId
    ? botTemplates.find((t) => t.id === input.templateId)
    : undefined;
  if (input.templateId && !selected) throw new ProductError('Template inválido.');
  const source = input.duplicateId
    ? await getBot(userId, workspaceId, input.duplicateId)
    : undefined;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId}, 0))`;
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const limit = workspace.plan === 'business' ? 20 : workspace.plan === 'pro' ? 5 : 1;
    if ((await tx.bot.count({ where: { workspaceId, status: { not: 'archived' } } })) >= limit)
      throw new ProductError(
        'Você atingiu o limite de bots do plano. Seus dados continuam salvos.',
        409,
      );
    const bot = await tx.bot.create({
      data: {
        workspaceId,
        name: input.name,
        description: selected?.description ?? source?.description ?? 'Seu assistente de conversas.',
        draft: (source?.draft ?? selected?.graph ?? blankGraph()) as Prisma.InputJsonValue,
      },
    });
    await tx.auditLog.create({ data: { workspaceId, actorId: userId, action: 'bot.created' } });
    return bot;
  });
}
export async function saveDraft(
  userId: string,
  workspaceId: string,
  id: string,
  graph: FlowGraph,
  revision: number,
) {
  await access(userId, workspaceId, true);
  const parsed = graphSchema.parse(graph);
  const result = await db.bot.updateMany({
    where: { workspaceId, id, draftRevision: revision, status: { not: 'archived' } },
    data: { draft: parsed as Prisma.InputJsonValue, draftRevision: { increment: 1 } },
  });
  if (!result.count)
    throw new ProductError('O fluxo mudou em outra aba. Recarregue antes de salvar.', 409);
  return { revision: revision + 1 };
}
export async function publishBot(
  userId: string,
  workspaceId: string,
  id: string,
  revision: number,
) {
  await access(userId, workspaceId, true);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId + ':' + id}, 0))`;
    const bot = await tx.bot.findFirst({ where: { workspaceId, id, status: { not: 'archived' } } });
    if (!bot) throw new ProductError('Bot não encontrado.', 404);
    if (bot.draftRevision !== revision)
      throw new ProductError('Salve a versão mais recente antes de publicar.', 409);
    const parsed = graphSchema.parse(bot.draft ?? blankGraph()),
      issues = validateGraph(parsed);
    if (issues.length) throw new ProductError(issues[0]!.message);
    const last = await tx.flowVersion.findFirst({
      where: { workspaceId, botId: id },
      orderBy: { number: 'desc' },
    });
    const version = await tx.flowVersion.create({
      data: {
        workspaceId,
        botId: id,
        number: (last?.number ?? 0) + 1,
        graph: parsed as Prisma.InputJsonValue,
      },
    });
    await tx.bot.updateMany({ where: { workspaceId, id }, data: { status: 'active' } });
    await tx.auditLog.create({ data: { workspaceId, actorId: userId, action: 'bot.published' } });
    return { id: version.id, number: version.number };
  });
}
export async function restoreVersion(
  userId: string,
  workspaceId: string,
  id: string,
  versionId: string,
  revision: number,
) {
  await access(userId, workspaceId, true);
  const v = await db.flowVersion.findFirst({ where: { workspaceId, botId: id, id: versionId } });
  if (!v) throw new ProductError('Versão não encontrada.', 404);
  return saveDraft(userId, workspaceId, id, graphSchema.parse(v.graph), revision);
}
export async function updateBot(
  userId: string,
  workspaceId: string,
  id: string,
  input: {
    name?: string;
    status?: 'paused' | 'active' | 'archived';
    settings?: Record<string, unknown>;
  },
) {
  await access(userId, workspaceId, true);
  await getBot(userId, workspaceId, id);
  if (
    input.status === 'active' &&
    !(await db.flowVersion.count({ where: { workspaceId, botId: id } }))
  )
    throw new ProductError('Publique um fluxo antes de ativar.');
  await db.bot.updateMany({
    where: { workspaceId, id },
    data: { ...input, settings: input.settings as Prisma.InputJsonValue | undefined },
  });
  return { ok: true };
}
