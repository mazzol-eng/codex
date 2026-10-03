import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '@bothub/db';
import {
  TelegramAdapter,
  SimulatorAdapter,
  type TelegramTransport,
  WhatsAppAdapter,
  FakeWhatsAppTransport,
  SmsAdapter,
  FakeSmsProvider,
  type WhatsAppTransport,
  type SmsProvider,
  type WhatsAppCredentials,
  type SmsCredentials,
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
  mode: true,
  externalAccountId: true,
  settings: true,
} as const;
export const connectionInputSchema = z
  .object({
    channel: z.enum(['simulator', 'telegram', 'whatsapp', 'sms']),
    name: z.string().trim().min(2).max(80),
    botId: z.string().min(1).max(80),
    mode: z.enum(['real', 'fake']).default('real'),
    token: z
      .string()
      .regex(/^\d{5,20}:[A-Za-z0-9_-]{20,120}$/)
      .optional(),
    credentials: z.record(z.string(), z.string().max(2000)).optional(),
    smsPriceCents: z.number().int().min(0).max(10000).default(10),
  })
  .strict();
export type AdapterTransports =
  | TelegramTransport
  | { telegram?: TelegramTransport; whatsapp?: WhatsAppTransport; sms?: SmsProvider };
function transportOptions(transport?: AdapterTransports) {
  return transport && 'call' in transport ? { telegram: transport } : transport;
}
const whatsappCredentialsSchema = z
  .object({
    phoneNumberId: z.string().regex(/^\d{5,32}$/),
    wabaId: z.string().regex(/^\d{5,32}$/),
    accessToken: z.string().min(12).max(2000),
    verifyToken: z.string().min(16).max(100),
    appSecret: z.string().min(16).max(100),
    apiVersion: z
      .string()
      .regex(/^v\d{2}\.\d+$/)
      .optional(),
  })
  .strict();
const smsCredentialsSchema = z
  .object({
    accountSid: z.string().regex(/^AC[a-f\d]{32}$/i),
    authToken: z.string().min(16).max(100),
    from: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/)
      .optional(),
    messagingServiceSid: z
      .string()
      .regex(/^MG[a-f\d]{32}$/i)
      .optional(),
  })
  .strict()
  .refine(
    (value) => !!(value.from || value.messagingServiceSid),
    'Informe o número ou Messaging Service.',
  );
export function verificationHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export async function listConnections(userId: string, workspaceId: string) {
  await access(userId, workspaceId);
  return db.connection.findMany({ where: { workspaceId }, select, orderBy: { createdAt: 'desc' } });
}
export function adapterFor(
  connection: { channel: string; credentialCiphertext: string | null; mode?: string; id?: string },
  transport?: AdapterTransports,
): ChannelAdapter {
  const options = transportOptions(transport);
  if (connection.channel === 'simulator') return new SimulatorAdapter();
  if (connection.channel === 'telegram' && connection.credentialCiphertext)
    return new TelegramAdapter(
      openCredentials(connection.credentialCiphertext) as { token: string; secretToken: string },
      options?.telegram,
    );
  if (connection.channel === 'whatsapp' && connection.credentialCiphertext)
    return new WhatsAppAdapter(
      openCredentials(connection.credentialCiphertext) as unknown as WhatsAppCredentials,
      options?.whatsapp ?? (connection.mode === 'fake' ? new FakeWhatsAppTransport() : undefined),
    );
  if (connection.channel === 'sms' && connection.credentialCiphertext) {
    const credentials = openCredentials(
      connection.credentialCiphertext,
    ) as unknown as SmsCredentials;
    const base = process.env.PUBLIC_WEBHOOK_URL;
    if (base?.startsWith('https://') && connection.id)
      credentials.statusCallback = `${base.replace(/\/$/, '')}/api/webhooks/sms/${connection.id}/status`;
    return new SmsAdapter(
      credentials,
      options?.sms ?? (connection.mode === 'fake' ? new FakeSmsProvider() : undefined),
    );
  }
  throw new ProductError('Este canal ainda não está disponível.', 409);
}
export async function createConnection(
  userId: string,
  workspaceId: string,
  input: {
    channel: 'simulator' | 'telegram' | 'whatsapp' | 'sms';
    name: string;
    botId: string;
    token?: string;
    mode?: 'real' | 'fake';
    credentials?: Record<string, string>;
    smsPriceCents?: number;
  },
  transport?: AdapterTransports,
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
  if (input.channel === 'whatsapp' || input.channel === 'sms') {
    const fake = input.mode === 'fake';
    const credentials =
      input.channel === 'whatsapp'
        ? whatsappCredentialsSchema.parse(
            fake
              ? {
                  phoneNumberId: '123456789012',
                  wabaId: '123456789012',
                  accessToken: 'fake-access-token',
                  verifyToken: randomBytes(24).toString('hex'),
                  appSecret: 'fake-app-secret-000',
                }
              : input.credentials,
          )
        : smsCredentialsSchema.parse(
            fake
              ? {
                  accountSid: `AC${'0'.repeat(32)}`,
                  authToken: 'fake-auth-token-000',
                  from: '+5511999990000',
                }
              : input.credentials,
          );
    const candidate = {
      channel: input.channel,
      mode: fake ? 'fake' : 'real',
      credentialCiphertext: sealCredentials(credentials),
    };
    const adapter = adapterFor(candidate, transport);
    if (!(await adapter.validateCredentials(credentials)))
      throw new ProductError(
        'Não conseguimos validar a conta existente. Confira os dados e a conexão.',
      );
    if (!fake && input.channel === 'whatsapp')
      try {
        await (adapter as WhatsAppAdapter).subscribeApp();
      } catch {
        throw new ProductError(
          'Confira o WABA ID e a permissão whatsapp_business_management do token.',
        );
      }
    const externalAccountId = fake
      ? null
      : input.channel === 'whatsapp'
        ? (credentials as WhatsAppCredentials).phoneNumberId
        : ((credentials as SmsCredentials).messagingServiceSid ??
          (credentials as SmsCredentials).from);
    if (
      externalAccountId &&
      (await db.connection.findFirst({
        where: { channel: input.channel, externalAccountId },
        select: { id: true },
      }))
    )
      throw new ProductError('Esse número já está conectado. Revise suas conexões.', 409);
    const connection = await db.connection.create({
      data: {
        workspaceId,
        botId: bot.id,
        name: input.name,
        ...candidate,
        status: fake ? 'connected' : 'pending',
        externalAccountId,
        verificationHash:
          !fake && input.channel === 'whatsapp'
            ? verificationHash((credentials as WhatsAppCredentials).verifyToken)
            : null,
        settings: { smsPriceCents: input.smsPriceCents ?? 10 },
      },
      select,
    });
    if (!fake && input.channel === 'sms')
      await testConnection(userId, workspaceId, connection.id, transport);
    return db.connection.findFirstOrThrow({ where: { workspaceId, id: connection.id }, select });
  }
  if (!input.token) throw new ProductError('Cole o token do BotFather.');
  const credentials = { token: input.token, secretToken: randomBytes(24).toString('hex') };
  const adapter = new TelegramAdapter(credentials, transportOptions(transport)?.telegram);
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
  transport?: AdapterTransports,
) {
  await access(userId, workspaceId, true);
  const connection = await db.connection.findFirst({ where: { workspaceId, id } });
  if (!connection) throw new ProductError('Canal não encontrado.', 404);
  const adapter = adapterFor(connection, transport);
  const valid = await adapter.validateCredentials(
    connection.credentialCiphertext ? openCredentials(connection.credentialCiphertext) : {},
  );
  let status = valid ? 'connected' : 'error';
  if (valid && connection.mode !== 'fake' && connection.channel === 'whatsapp')
    status = connection.status === 'connected' ? 'connected' : 'pending';
  if (valid && connection.mode !== 'fake' && connection.channel === 'sms') {
    const url = process.env.PUBLIC_WEBHOOK_URL;
    if (url?.startsWith('https://'))
      try {
        const a = adapter as SmsAdapter;
        await a.provider.configure(
          a.credentials,
          `${url.replace(/\/$/, '')}/api/webhooks/sms/${id}`,
        );
      } catch {
        status = 'pending';
      }
    else status = 'pending';
  }
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
