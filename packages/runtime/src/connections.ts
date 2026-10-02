import { randomBytes } from 'node:crypto';
import { db } from '@bothub/db';
import {
  TelegramAdapter,
  SimulatorAdapter,
  type TelegramTransport,
} from '@bothub/channels/adapters';
import { access, ProductError } from './bots';
import type { ChannelAdapter } from '@bothub/channels';
import { sealCredentials, openCredentials } from './credentials';
const select = {
  id: true,
  name: true,
  channel: true,
  status: true,
  botId: true,
  createdAt: true,
} as const;
export async function listConnections(userId: string, workspaceId: string) {
  await access(userId, workspaceId);
  return db.connection.findMany({ where: { workspaceId }, select, orderBy: { createdAt: 'desc' } });
}
export function adapterFor(
  connection: { channel: string; credentialCiphertext: string | null },
  transport?: TelegramTransport,
): ChannelAdapter {
  if (connection.channel === 'simulator') return new SimulatorAdapter();
  if (connection.channel === 'telegram' && connection.credentialCiphertext)
    return new TelegramAdapter(
      openCredentials(connection.credentialCiphertext) as { token: string; secretToken: string },
      transport,
    );
  throw new ProductError('Este canal ainda não está disponível.', 409);
}
export async function createConnection(
  userId: string,
  workspaceId: string,
  input: { channel: 'simulator' | 'telegram'; name: string; botId: string; token?: string },
  transport?: TelegramTransport,
) {
  await access(userId, workspaceId, true);
  const bot = await db.bot.findFirst({
    where: { workspaceId, id: input.botId, status: { not: 'archived' } },
  });
  if (!bot) throw new ProductError('Escolha um bot desta empresa.');
  if (input.channel === 'simulator')
    return db.connection.create({
      data: {
        workspaceId,
        botId: bot.id,
        channel: 'simulator',
        name: input.name,
        status: 'connected',
      },
      select,
    });
  if (!input.token) throw new ProductError('Cole o token do BotFather.');
  const credentials = { token: input.token, secretToken: randomBytes(24).toString('hex') };
  const adapter = new TelegramAdapter(credentials, transport);
  if (!(await adapter.validateCredentials(credentials)))
    throw new ProductError('Não conseguimos validar o token. Confira o BotFather e sua conexão.');
  const connection = await db.connection.create({
    data: {
      workspaceId,
      botId: bot.id,
      channel: 'telegram',
      name: input.name,
      status: 'pending',
      credentialCiphertext: sealCredentials(credentials),
    },
  });
  try {
    const base = process.env.PUBLIC_WEBHOOK_URL;
    if (!base || new URL(base).protocol !== 'https:') throw new Error('public_https_required');
    await adapter.registerWebhook(
      `${base.replace(/\/$/, '')}/api/webhooks/telegram/${connection.id}`,
    );
    await db.connection.updateMany({
      where: { workspaceId, id: connection.id },
      data: { status: 'connected' },
    });
  } catch {
    await db.connection.updateMany({
      where: { workspaceId, id: connection.id },
      data: { status: 'pending' },
    });
  }
  return db.connection.findFirstOrThrow({ where: { workspaceId, id: connection.id }, select });
}
export async function testConnection(
  userId: string,
  workspaceId: string,
  id: string,
  transport?: TelegramTransport,
) {
  await access(userId, workspaceId, true);
  const connection = await db.connection.findFirst({ where: { workspaceId, id } });
  if (!connection) throw new ProductError('Canal não encontrado.', 404);
  const adapter = adapterFor(connection, transport);
  const valid = await adapter.validateCredentials(
    connection.credentialCiphertext ? openCredentials(connection.credentialCiphertext) : {},
  );
  let status = valid ? 'connected' : 'error';
  if (valid && connection.channel === 'telegram') {
    const url = process.env.PUBLIC_WEBHOOK_URL;
    if (url?.startsWith('https://')) {
      try {
        await (adapter as TelegramAdapter).registerWebhook(
          `${url.replace(/\/$/, '')}/api/webhooks/telegram/${connection.id}`,
        );
      } catch {
        status = 'pending';
      }
    } else status = 'pending';
  }
  await db.connection.updateMany({ where: { workspaceId, id }, data: { status } });
  return { valid, status };
}
export async function connectionEvents(userId: string, workspaceId: string, id: string) {
  await access(userId, workspaceId);
  return db.webhookEvent.findMany({
    where: { workspaceId, connectionId: id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, status: true, createdAt: true, lastError: true, attempts: true },
  });
}
