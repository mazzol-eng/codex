import { db } from './index';
export class AccessDenied extends Error {
  constructor() {
    super('Workspace access denied');
  }
}
export async function authorizeWorkspace(userId: string, workspaceId: string) {
  const membership = await db.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!membership) throw new AccessDenied();
  return membership;
}
export async function listWorkspaces(userId: string) {
  return db.workspace.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: 'asc' },
  });
}
export async function getDashboard(
  userId: string,
  workspaceId: string,
  days = 7,
  now = new Date(),
) {
  await authorizeWorkspace(userId, workspaceId);
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  start.setUTCHours(0, 0, 0, 0);
  const [metrics, bots, connections, contacts, activeConversations, members] = await Promise.all([
    db.dailyMetric.findMany({
      where: { workspaceId, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    }),
    db.bot.findMany({ where: { workspaceId }, orderBy: { conversations: 'desc' } }),
    db.connection.findMany({
      where: { workspaceId },
      select: { id: true, channel: true, name: true, status: true },
    }),
    db.contact.count({ where: { workspaceId } }),
    db.conversation.count({ where: { workspaceId, status: 'open' } }),
    db.membership.count({ where: { workspaceId } }),
  ]);
  const sums = metrics.reduce(
    (s, m) => ({
      sent: s.sent + m.sent,
      received: s.received + m.received,
      newContacts: s.newContacts + m.newContacts,
      completed: s.completed + m.completed,
      started: s.started + m.started,
      responseTotal: s.responseTotal + m.responseTimeMs * m.received,
    }),
    { sent: 0, received: 0, newContacts: 0, completed: 0, started: 0, responseTotal: 0 },
  );
  const series = Array.from({ length: days }, (_, i) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    const key = date.toISOString().slice(0, 10);
    const items = metrics.filter((m) => m.date.toISOString().slice(0, 10) === key);
    return {
      date: key,
      sent: items.reduce((s, m) => s + m.sent, 0),
      received: items.reduce((s, m) => s + m.received, 0),
    };
  });
  return {
    workspace,
    bots,
    connections,
    totals: {
      ...sums,
      contacts,
      activeConversations,
      members,
      completionRate: sums.started ? Math.round((100 * sums.completed) / sums.started) : 0,
      responseSeconds: sums.received ? Math.round(sums.responseTotal / sums.received / 1000) : 0,
    },
    series,
    channels: ['whatsapp', 'telegram', 'sms'].map((channel) => ({
      channel,
      total: metrics
        .filter((m) => m.channel === channel)
        .reduce((s, m) => s + m.sent + m.received, 0),
    })),
  };
}
export async function createWorkspace(
  userId: string,
  input: { name: string; segment: string; timeZone: string },
) {
  return db.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { ...input, members: { create: { userId, role: 'owner' } } },
    });
    await tx.auditLog.create({
      data: { workspaceId: workspace.id, actorId: userId, action: 'workspace.created' },
    });
    return workspace;
  });
}
