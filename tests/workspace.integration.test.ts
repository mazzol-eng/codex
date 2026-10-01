import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import {
  db,
  createWorkspace,
  getDashboard,
  listWorkspaces,
  authorizeWorkspace,
  AccessDenied,
} from '../packages/db/src/index';
const runId = randomUUID();
const userA = `test-a-${runId}`,
  userB = `test-b-${runId}`;
let workspaceA: string, workspaceB: string;
beforeAll(async () => {
  await db.user.createMany({
    data: [
      { id: userA, name: 'Test A', email: `a-${runId}@test.local` },
      { id: userB, name: 'Test B', email: `b-${runId}@test.local` },
    ],
  });
  workspaceA = (
    await createWorkspace(userA, {
      name: 'Company A',
      segment: 'Serviços',
      timeZone: 'America/Sao_Paulo',
    })
  ).id;
  workspaceB = (
    await createWorkspace(userB, {
      name: 'Company B',
      segment: 'Comércio',
      timeZone: 'America/Manaus',
    })
  ).id;
  await db.bot.createMany({
    data: [
      { workspaceId: workspaceA, name: 'Bot A', description: 'Only A' },
      { workspaceId: workspaceB, name: 'Bot B', description: 'Only B' },
    ],
  });
  await db.dailyMetric.createMany({
    data: [
      {
        workspaceId: workspaceA,
        date: new Date('2026-10-01'),
        channel: 'telegram',
        sent: 10,
        received: 5,
        started: 4,
        completed: 3,
      },
      { workspaceId: workspaceB, date: new Date('2026-10-01'), channel: 'telegram', sent: 900 },
      { workspaceId: workspaceA, date: new Date('2026-10-02'), channel: 'telegram', sent: 400 },
    ],
  });
}, 15000);
afterAll(async () => {
  if (workspaceA || workspaceB)
    await db.workspace.deleteMany({
      where: { id: { in: [workspaceA, workspaceB].filter(Boolean) } },
    });
  await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await db.$disconnect();
});
describe('tenant isolation using PostgreSQL', () => {
  it('denies membership in another workspace', async () => {
    await expect(authorizeWorkspace(userA, workspaceB)).rejects.toBeInstanceOf(AccessDenied);
  });
  it('denies reading another workspace dashboard', async () => {
    await expect(getDashboard(userA, workspaceB)).rejects.toBeInstanceOf(AccessDenied);
  });
  it('lists only workspaces for the authenticated identity', async () => {
    expect((await listWorkspaces(userA)).map((w) => w.id)).toEqual([workspaceA]);
  });
  it('filters bots and aggregates, including date boundaries', async () => {
    const data = await getDashboard(userA, workspaceA, 7, new Date('2026-10-01T18:00:00Z'));
    expect(data.bots.map((b) => b.name)).toEqual(['Bot A']);
    expect(data.totals.sent).toBe(10);
    expect(data.totals.completionRate).toBe(75);
    expect(data.series).toHaveLength(7);
  });
  it('uses the workspace time zone at local midnight', async () => {
    const data = await getDashboard(userA, workspaceA, 7, new Date('2026-10-01T01:00:00Z'));
    expect(data.totals.sent).toBe(0);
    expect(data.series.at(-1)?.date).toBe('2026-09-30');
  });
  it('creates new workspaces without demo metrics or channels', async () => {
    const data = await getDashboard(userB, workspaceB, 7, new Date('2026-09-01'));
    expect(data.workspace.isDemo).toBe(false);
    expect(data.connections).toHaveLength(0);
    expect(data.totals.sent).toBe(0);
  });
  it('enforces tenant consistency for contact foreign keys', async () => {
    const contact = await db.contact.create({
      data: { workspaceId: workspaceA, name: 'Private Contact', channel: 'telegram' },
    });
    await expect(
      db.conversation.create({
        data: { workspaceId: workspaceB, contactId: contact.id, channel: 'telegram' },
      }),
    ).rejects.toThrow();
  });
  it('never serializes credential ciphertext in dashboard connections', async () => {
    await db.connection.create({
      data: {
        workspaceId: workspaceA,
        channel: 'telegram',
        name: 'Private',
        credentialCiphertext: 'encrypted-only',
      },
    });
    const data = await getDashboard(userA, workspaceA);
    expect(data.connections[0]).not.toHaveProperty('credentialCiphertext');
  });
});
