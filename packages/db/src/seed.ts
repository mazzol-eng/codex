import { config } from 'dotenv';
import { hash } from 'argon2';
import { db } from './index';
import { botTemplates } from '@bothub/flow-engine';
import { Prisma } from './generated/client';
config({ path: '../../.env', quiet: true });
const userId = 'demo-user';
await db.user.upsert({
  where: { id: userId },
  update: {},
  create: { id: userId, name: 'Marina Costa', email: 'demo@bothub.local', emailVerified: true },
});
await db.account.upsert({
  where: { providerId_accountId: { providerId: 'credential', accountId: userId } },
  update: {},
  create: {
    id: 'demo-account',
    userId,
    providerId: 'credential',
    accountId: userId,
    password: await hash('BotHubDemo2026!'),
  },
});
const workspaceId = 'demo-workspace';
await db.workspace.upsert({
  where: { id: workspaceId },
  update: {},
  create: {
    id: workspaceId,
    name: 'Estúdio Aurora',
    segment: 'Serviços',
    plan: 'pro',
    isDemo: true,
    members: { create: { userId, role: 'owner' } },
  },
});
for (const [i, name, description, channels] of [
  [
    0,
    'Assistente de atendimento',
    'Respostas rápidas, clientes mais felizes.',
    ['whatsapp', 'telegram'],
  ],
  [1, 'Novos clientes', 'Transforme uma conversa em uma oportunidade.', ['telegram']],
  [2, 'Lembretes de agendamento', 'Um lembrete na hora certa faz a diferença.', ['sms']],
] as const)
  await db.bot.upsert({
    where: { id: `demo-bot-${i}` },
    update: {},
    create: {
      id: `demo-bot-${i}`,
      workspaceId,
      name,
      description,
      channels: [...channels],
      status: i === 2 ? 'draft' : 'active',
      conversations: [1842, 956, 0][i],
      completionRate: [92, 86, 0][i],
    },
  });
// Add runnable graphs only to untouched illustrative bots; preserve user edits and publications.
for (const [i, templateId] of ['faq', 'leads', 'booking'].entries()) {
  const graph = botTemplates.find((t) => t.id === templateId)!.graph;
  await db.bot.updateMany({
    where: { workspaceId, id: `demo-bot-${i}`, draft: { equals: Prisma.DbNull } },
    data: { draft: graph as Prisma.InputJsonValue },
  });
}
const simulator = await db.connection.upsert({
  where: { id: 'demo-simulator' },
  update: {},
  create: {
    id: 'demo-simulator',
    workspaceId,
    botId: 'demo-bot-0',
    channel: 'simulator',
    name: 'Simulador do atendimento',
    status: 'connected',
  },
});
if (!(await db.flowVersion.count({ where: { workspaceId, botId: 'demo-bot-0' } }))) {
  const bot = await db.bot.findFirstOrThrow({ where: { workspaceId, id: 'demo-bot-0' } });
  await db.flowVersion.create({
    data: { workspaceId, botId: bot.id, number: 1, graph: bot.draft as Prisma.InputJsonValue },
  });
}
const demoContact = await db.contact.upsert({
  where: { id: 'demo-live-contact' },
  update: {},
  create: {
    id: 'demo-live-contact',
    workspaceId,
    connectionId: simulator.id,
    externalContactId: 'demo-client',
    name: 'Beatriz Almeida',
    channel: 'simulator',
    consent: true,
    consentSource: 'simulador de demonstração',
    consentAt: new Date(),
  },
});
const demoConversation = await db.conversation.upsert({
  where: { id: 'demo-live-conversation' },
  update: {},
  create: {
    id: 'demo-live-conversation',
    workspaceId,
    connectionId: simulator.id,
    contactId: demoContact.id,
    channel: 'simulator',
    mode: 'human',
    unread: 1,
    lastInboundAt: new Date(),
  },
});
for (const [i, direction, text] of [
  [0, 'inbound', 'Olá! Gostaria de saber mais sobre os serviços.'],
  [1, 'outbound', 'Olá, Beatriz! Que bom ter você aqui. Como podemos ajudar?'],
  [2, 'inbound', 'Podemos conversar sobre um agendamento?'],
] as const) {
  await db.message.upsert({
    where: {
      workspaceId_idempotencyKey: { workspaceId, idempotencyKey: `demo-seed-message-${i}` },
    },
    update: {},
    create: {
      workspaceId,
      conversationId: demoConversation.id,
      idempotencyKey: `demo-seed-message-${i}`,
      direction,
      content: { type: 'text', text },
      status: direction === 'inbound' ? 'received' : 'sent',
      createdAt: new Date(Date.now() - (3 - i) * 60000),
    },
  });
}
for (const channel of ['whatsapp', 'telegram', 'sms'])
  await db.connection.upsert({
    where: { id: `demo-${channel}` },
    update: {},
    create: {
      id: `demo-${channel}`,
      workspaceId,
      channel,
      name:
        channel === 'whatsapp'
          ? 'Número principal'
          : channel === 'telegram'
            ? '@aurora_demo_bot'
            : 'Lembretes',
      status: channel === 'sms' ? 'pending' : 'demo',
    },
  });
for (let i = 0; i < 38; i++) {
  const id = `demo-contact-${i}`;
  await db.contact.upsert({
    where: { id },
    update: {},
    create: {
      id,
      workspaceId,
      name: `Contato exemplo ${i + 1}`,
      channel: i % 2 ? 'telegram' : 'whatsapp',
      consent: true,
      consentSource: 'seed demonstrativo',
      consentAt: new Date(),
    },
  });
  await db.conversation.upsert({
    where: { id: `demo-conversation-${i}` },
    update: {},
    create: {
      id: `demo-conversation-${i}`,
      workspaceId,
      contactId: id,
      channel: i % 2 ? 'telegram' : 'whatsapp',
      status: 'open',
    },
  });
}
for (let day = 0; day < 30; day++) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - day);
  for (const [index, channel] of ['whatsapp', 'telegram', 'sms'].entries()) {
    const factor = [1, 0.45, 0.15][index] ?? 1;
    const sent = Math.round((170 + ((day * 37) % 130)) * factor);
    await db.dailyMetric.upsert({
      where: { workspaceId_date_channel: { workspaceId, date, channel } },
      update: {},
      create: {
        workspaceId,
        date,
        channel,
        sent,
        received: Math.round(sent * 0.7),
        newContacts: Math.round(sent * 0.035),
        completed: Math.round(sent * 0.08),
        started: Math.round(sent * 0.09),
        responseTimeMs: 4000 + day * 40,
      },
    });
  }
}
console.log('Demo workspace seeded. See README for local sign-in details.');
await db.$disconnect();
