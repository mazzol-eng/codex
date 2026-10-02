import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { db, createWorkspace, AccessDenied } from '../packages/db/src/index';
import {
  createBot,
  saveDraft,
  publishBot,
  getBot,
  restoreVersion,
  createConnection,
  ingest,
  processEvent,
  listConnections,
  getConversation,
  actOnConversation,
  sendPending,
  sealCredentials,
  openCredentials,
  enqueueDueSessions,
} from '../packages/runtime/src/index';
import { graphSchema } from '../packages/flow-engine/src/index';
import { FakeTelegramTransport } from '../packages/channels/src/adapters';
const run = randomUUID(),
  user = `phase2-${run}`,
  other = `phase2-other-${run}`;
let workspaceId: string,
  otherWorkspace: string,
  botId: string,
  connectionId: string,
  conversationId: string,
  versionId: string;
beforeAll(async () => {
  await db.user.createMany({
    data: [
      { id: user, name: 'Phase Two', email: `${user}@test.local` },
      { id: other, name: 'Other', email: `${other}@test.local` },
    ],
  });
  workspaceId = (
    await createWorkspace(user, {
      name: 'Phase Two',
      segment: 'Serviços',
      timeZone: 'America/Sao_Paulo',
    })
  ).id;
  otherWorkspace = (
    await createWorkspace(other, {
      name: 'Other',
      segment: 'Serviços',
      timeZone: 'America/Sao_Paulo',
    })
  ).id;
  botId = (await createBot(user, workspaceId, { name: 'Atendimento', templateId: 'leads' })).id;
  versionId = (await publishBot(user, workspaceId, botId, 0)).id;
  connectionId = (
    await createConnection(user, workspaceId, { name: 'Teste local', botId, channel: 'simulator' })
  ).id;
}, 15000);
afterAll(async () => {
  await db.workspace.deleteMany({
    where: { id: { in: [workspaceId, otherWorkspace].filter(Boolean) } },
  });
  await db.user.deleteMany({ where: { id: { in: [user, other] } } });
  await db.$disconnect();
});
async function receive(text: string, id: string) {
  const connection = { id: connectionId, workspaceId };
  const e = await ingest(connection, {
    channel: 'simulator',
    connectionId,
    externalContactId: 'fixture-client',
    externalMessageId: id,
    type: 'text',
    text,
    timestamp: new Date().toISOString(),
    contactName: 'Ana Silva',
  });
  await processEvent(workspaceId, e.id);
  return e;
}
it('deduplicates inbound events and writes a single conversation/message', async () => {
  const a = await receive('oi', 'first');
  const b = await receive('oi', 'first');
  expect(a.id).toBe(b.id);
  const c = await db.conversation.findFirstOrThrow({ where: { workspaceId, connectionId } });
  conversationId = c.id;
  expect(
    await db.message.count({ where: { workspaceId, conversationId, direction: 'inbound' } }),
  ).toBe(1);
  expect(c.versionId).toBe(versionId);
  expect((c.session as { waiting: { nodeId: string } }).waiting.nodeId).toBe('ask');
});
it('keeps an ongoing session on its immutable published version', async () => {
  const bot = await getBot(user, workspaceId, botId);
  const graph = graphSchema.parse(bot.draft);
  graph.nodes.find((n) => n.id === 'reply')!.data.text = 'NEW VERSION';
  await saveDraft(user, workspaceId, botId, graph, 0);
  const newer = await publishBot(user, workspaceId, botId, 1);
  expect(newer.id).not.toBe(versionId);
  await receive('ana@example.com', 'second');
  const c = await getConversation(user, workspaceId, conversationId);
  expect(c.versionId).toBe(versionId);
  expect(c.messages.filter((m) => m.direction === 'outbound').at(-1)?.content).toMatchObject({
    text: expect.stringContaining('ana@example.com'),
  });
});
it('restores a published version only into the draft and rejects stale saves', async () => {
  await restoreVersion(user, workspaceId, botId, versionId, 1);
  const bot = await getBot(user, workspaceId, botId);
  expect(bot.draftRevision).toBe(2);
  expect(bot.versions).toHaveLength(2);
  await expect(
    saveDraft(user, workspaceId, botId, graphSchema.parse(bot.draft), 1),
  ).rejects.toMatchObject({ status: 409 });
});
it('supports human takeover, notes, replies and return to bot', async () => {
  await actOnConversation(user, workspaceId, conversationId, { action: 'take' });
  const before = await db.message.count({
    where: { workspaceId, conversationId, direction: 'outbound' },
  });
  await receive('oi', 'human-inbound');
  expect(
    await db.message.count({ where: { workspaceId, conversationId, direction: 'outbound' } }),
  ).toBe(before);
  await actOnConversation(user, workspaceId, conversationId, {
    action: 'note',
    text: 'Internal note',
  });
  await actOnConversation(user, workspaceId, conversationId, {
    action: 'reply',
    text: 'Olá, Ana!',
  });
  const reply = await db.message.findFirstOrThrow({
    where: { workspaceId, conversationId, direction: 'outbound' },
    orderBy: { createdAt: 'desc' },
  });
  await sendPending(reply.id, workspaceId);
  expect((await db.message.findFirstOrThrow({ where: { workspaceId, id: reply.id } })).status).toBe(
    'sent',
  );
  await actOnConversation(user, workspaceId, conversationId, { action: 'return' });
  expect((await getConversation(user, workspaceId, conversationId)).mode).toBe('bot');
});
it('honors opt-out and prevents human outbound replies', async () => {
  await receive('PARAR', 'optout');
  const c = await getConversation(user, workspaceId, conversationId);
  expect(c.contact.consent).toBe(false);
  await actOnConversation(user, workspaceId, conversationId, { action: 'take' });
  await expect(
    actOnConversation(user, workspaceId, conversationId, { action: 'reply', text: 'Forbidden' }),
  ).rejects.toMatchObject({ status: 409 });
});
it('blocks cross-tenant bots/conversations/versions and viewer writes', async () => {
  await expect(getBot(other, workspaceId, botId)).rejects.toBeInstanceOf(AccessDenied);
  await expect(getBot(other, otherWorkspace, botId)).rejects.toMatchObject({ status: 404 });
  await expect(getConversation(other, otherWorkspace, conversationId)).rejects.toMatchObject({
    status: 404,
  });
  await expect(restoreVersion(other, otherWorkspace, botId, versionId, 0)).rejects.toMatchObject({
    status: 404,
  });
  await db.membership.create({ data: { workspaceId, userId: other, role: 'viewer' } });
  await expect(createBot(other, workspaceId, { name: 'No access' })).rejects.toBeInstanceOf(
    AccessDenied,
  );
  await expect(
    actOnConversation(other, workspaceId, conversationId, { action: 'take' }),
  ).rejects.toBeInstanceOf(AccessDenied);
});
it('encrypts Telegram credentials and omits them from responses', async () => {
  const fake = new FakeTelegramTransport();
  const connection = await createConnection(
    user,
    workspaceId,
    { botId, name: 'Existing Telegram bot', channel: 'telegram', token: '123456:fixture-token' },
    fake,
  );
  const record = await db.connection.findFirstOrThrow({
    where: { workspaceId, id: connection.id },
  });
  expect(record.credentialCiphertext).not.toContain('fixture-token');
  expect(openCredentials(record.credentialCiphertext!).token).toBe('123456:fixture-token');
  expect(await listConnections(user, workspaceId)).not.toContainEqual(
    expect.objectContaining({ credentialCiphertext: expect.anything() }),
  );
  expect(connection).not.toHaveProperty('credentialCiphertext');
});
it('retries transient send failures with backoff and caps attempts', async () => {
  const connection = await db.connection.create({
    data: {
      workspaceId,
      botId,
      name: 'Fixture delivery',
      channel: 'telegram',
      status: 'fixture',
      credentialCiphertext: sealCredentials({ token: 'fake', secretToken: 'secret' }),
    },
  });
  const contact = await db.contact.create({
    data: {
      workspaceId,
      connectionId: connection.id,
      externalContactId: '123',
      name: 'Fixture',
      channel: 'telegram',
      consent: true,
    },
  });
  const c = await db.conversation.create({
    data: { workspaceId, contactId: contact.id, connectionId: connection.id, channel: 'telegram' },
  });
  const m = await db.message.create({
    data: {
      workspaceId,
      conversationId: c.id,
      direction: 'outbound',
      status: 'pending',
      content: { type: 'text', text: 'Hello' },
    },
  });
  const fake = new FakeTelegramTransport();
  fake.fail = 'network_failure';
  const now = Date.now();
  await sendPending(m.id, workspaceId, fake, now);
  let saved = await db.message.findFirstOrThrow({ where: { workspaceId, id: m.id } });
  expect(saved.status).toBe('pending');
  expect(saved.attempts).toBe(1);
  expect(saved.nextAttemptAt.getTime()).toBeGreaterThan(now);
  fake.fail = undefined;
  await sendPending(m.id, workspaceId, fake, now + 3000);
  saved = await db.message.findFirstOrThrow({ where: { workspaceId, id: m.id } });
  expect(saved.status).toBe('sent');
  expect(saved.attempts).toBe(2);
});

it('enforces published immutability in PostgreSQL', async () => {
  await expect(
    db.flowVersion.updateMany({ where: { workspaceId, id: versionId }, data: { number: 99 } }),
  ).rejects.toThrow();
});
it('enforces tenant consistency on bot and version foreign keys', async () => {
  await expect(
    db.connection.create({
      data: { workspaceId: otherWorkspace, botId, channel: 'simulator', name: 'Forbidden' },
    }),
  ).rejects.toThrow();
  const contact = await db.contact.create({
    data: { workspaceId: otherWorkspace, name: 'Other', channel: 'simulator' },
  });
  await expect(
    db.conversation.create({
      data: { workspaceId: otherWorkspace, contactId: contact.id, channel: 'simulator', versionId },
    }),
  ).rejects.toThrow();
});
it('blocks already queued sends after opt-out while allowing the confirmation', async () => {
  const c = await getConversation(user, workspaceId, conversationId);
  const pending = await db.message.findMany({
    where: { workspaceId, conversationId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });
  for (const m of pending) await sendPending(m.id, workspaceId);
  const message = await db.message.create({
    data: {
      workspaceId,
      conversationId,
      direction: 'outbound',
      sender: 'human',
      status: 'pending',
      content: { type: 'text', text: 'Should not send' },
    },
  });
  await sendPending(message.id, workspaceId);
  expect(
    (await db.message.findFirstOrThrow({ where: { workspaceId, id: message.id } })).lastError,
  ).toBe('contact_opted_out');
  expect(c.contact.consent).toBe(false);
});
it('resumes a persisted wait after the worker clock reaches its deadline', async () => {
  const bot = await getBot(user, workspaceId, botId);
  const graph = graphSchema.parse(bot.draft);
  graph.nodes.find((n) => n.id === 'ask')!.type = 'wait';
  graph.nodes.find((n) => n.id === 'ask')!.data = { seconds: 1 };
  graph.nodes.find((n) => n.id === 'reply')!.data.text = 'Wait finished';
  await saveDraft(user, workspaceId, botId, graph, bot.draftRevision);
  await publishBot(user, workspaceId, botId, bot.draftRevision + 1);
  const incoming = await ingest(
    { id: connectionId, workspaceId },
    {
      channel: 'simulator',
      connectionId,
      externalContactId: 'timer-client',
      externalMessageId: 'timer-start',
      type: 'text',
      text: 'oi',
      timestamp: new Date().toISOString(),
    },
  );
  await processEvent(workspaceId, incoming.id);
  const c = await db.conversation.findFirstOrThrow({
    where: { workspaceId, connectionId, contact: { externalContactId: 'timer-client' } },
  });
  const state = c.session as { waiting: { expiresAt: number } };
  state.waiting.expiresAt = Date.now() - 1000;
  await db.conversation.updateMany({ where: { workspaceId, id: c.id }, data: { session: state } });
  await enqueueDueSessions();
  const resumed = await db.webhookEvent.findFirstOrThrow({
    where: { workspaceId, connectionId, externalId: { startsWith: `resume:${c.id}:` } },
  });
  await processEvent(workspaceId, resumed.id);
  expect((await getConversation(user, workspaceId, c.id)).messages.at(-1)?.content).toMatchObject({
    text: 'Wait finished',
  });
});
