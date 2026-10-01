import { config } from 'dotenv';
import { hash } from 'argon2';
import { db } from './index';
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
console.log('Demo workspace seeded. Local login: demo@bothub.local / BotHubDemo2026!');
await db.$disconnect();
