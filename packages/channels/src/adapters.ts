import { randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { fetch as proxyFetch, EnvHttpProxyAgent } from 'undici';
const proxyAgent = new EnvHttpProxyAgent();
import {
  type ChannelAdapter,
  type InboundEvent,
  type OutboundMessage,
  degradeMessage,
} from './index';
export class SimulatorAdapter implements ChannelAdapter {
  readonly channel = 'simulator' as const;
  readonly capabilities = { buttons: true, lists: true, media: true, readReceipts: false };
  readonly sent: { contactId: string; message: OutboundMessage }[] = [];
  async validateCredentials() {
    return true;
  }
  verifyWebhook() {
    return false;
  }
  normalize(body: unknown, connectionId: string): InboundEvent[] {
    const b = z
      .object({
        text: z.string().max(2000),
        contactId: z.string().max(100),
        id: z.string().max(100),
        timestamp: z.string().datetime().optional(),
      })
      .safeParse(body);
    return b.success
      ? [
          {
            channel: this.channel,
            connectionId,
            externalContactId: b.data.contactId,
            externalMessageId: b.data.id,
            type: 'text',
            text: b.data.text,
            timestamp: b.data.timestamp ?? new Date().toISOString(),
          },
        ]
      : [];
  }
  async send(contactId: string, message: OutboundMessage) {
    this.sent.push({ contactId, message });
    return { externalId: randomUUID(), status: 'sent' as const };
  }
  interpretStatus() {
    return undefined;
  }
}
export interface TelegramTransport {
  call(method: string, token: string, body: Record<string, unknown>): Promise<unknown>;
}
export class TelegramHttpTransport implements TelegramTransport {
  async call(method: string, token: string, body: Record<string, unknown>): Promise<unknown> {
    let response;
    try {
      response = await proxyFetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        dispatcher: proxyAgent,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new ChannelError('network_failure');
    }
    const parsed = z
      .object({
        ok: z.boolean(),
        result: z.unknown().optional(),
        parameters: z.object({ retry_after: z.number().optional() }).optional(),
      })
      .safeParse(await response.json().catch(() => null));
    if (!response.ok || !parsed.success || !parsed.data.ok)
      throw new ChannelError(
        response.status === 429 ? 'rate_limited' : 'telegram_request_failed',
        parsed.success ? parsed.data.parameters?.retry_after : undefined,
      );
    return parsed.data.result;
  }
}
export class ChannelError extends Error {
  constructor(
    public code: string,
    public retryAfter?: number,
  ) {
    super(code);
  }
}
const chat = z.object({
  id: z.union([z.number().int(), z.string()]),
  first_name: z.string().optional(),
});
const msg = z.object({
  message_id: z.number().int(),
  date: z.number(),
  chat,
  text: z.string().max(10000).optional(),
  caption: z.string().optional(),
  photo: z.array(z.object({ file_id: z.string() })).optional(),
  video: z.object({ file_id: z.string() }).optional(),
  audio: z.object({ file_id: z.string() }).optional(),
  document: z.object({ file_id: z.string() }).optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
});
const update = z.object({
  update_id: z.number().int(),
  message: msg.optional(),
  callback_query: z
    .object({
      id: z.string(),
      from: chat,
      message: msg.optional(),
      data: z.string().max(64).optional(),
    })
    .optional(),
});
export class TelegramAdapter implements ChannelAdapter {
  readonly channel = 'telegram' as const;
  readonly capabilities = { buttons: true, lists: false, media: true, readReceipts: false };
  constructor(
    private credentials: { token: string; secretToken: string },
    private transport: TelegramTransport = new TelegramHttpTransport(),
  ) {}
  async validateCredentials(credentials: Record<string, string>) {
    try {
      const me = z
        .object({ id: z.number(), is_bot: z.literal(true), username: z.string() })
        .parse(await this.transport.call('getMe', credentials.token ?? this.credentials.token, {}));
      return !!me.id;
    } catch {
      return false;
    }
  }
  async identity() {
    return z
      .object({ id: z.number(), username: z.string() })
      .parse(await this.transport.call('getMe', this.credentials.token, {}));
  }
  async registerWebhook(url: string) {
    if (new URL(url).protocol !== 'https:') throw new ChannelError('https_required');
    await this.transport.call('setWebhook', this.credentials.token, {
      url,
      secret_token: this.credentials.secretToken,
      allowed_updates: ['message', 'callback_query'],
    });
  }
  verifyWebhook(_body: string, headers: Record<string, string>) {
    const input = headers['x-telegram-bot-api-secret-token'] ?? '';
    const a = Buffer.from(input),
      b = Buffer.from(this.credentials.secretToken);
    return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
  }
  normalize(body: unknown, connectionId: string): InboundEvent[] {
    const result = update.safeParse(body);
    if (!result.success) return [];
    const u = result.data,
      c = u.callback_query,
      m = u.message ?? c?.message;
    if (!m) return [];
    const media =
      m.photo?.at(-1)?.file_id ?? m.video?.file_id ?? m.audio?.file_id ?? m.document?.file_id;
    const type = c ? 'button_reply' : m.location ? 'location' : media ? 'media' : 'text';
    const payload = c
      ? c.data?.startsWith('c:')
        ? c.data.slice(2)
        : c.data
      : (m.location ?? (media ? { fileId: media } : undefined));
    return [
      {
        channel: this.channel,
        connectionId,
        externalContactId: String(m.chat.id),
        externalMessageId: String(u.update_id),
        type,
        text: m.text ?? m.caption,
        payload,
        timestamp: new Date(c ? Date.now() : m.date * 1000).toISOString(),
        contactName: c?.from.first_name ?? m.chat.first_name,
        callbackQueryId: c?.id,
      },
    ];
  }
  async acknowledge(event: InboundEvent) {
    if (event.callbackQueryId)
      await this.transport.call('answerCallbackQuery', this.credentials.token, {
        callback_query_id: event.callbackQueryId,
      });
  }
  async send(contactId: string, message: OutboundMessage) {
    const m = degradeMessage(this.channel, message);
    let method = 'sendMessage';
    const body: Record<string, unknown> = { chat_id: contactId, text: m.text };
    if (m.choices?.length)
      body.reply_markup = {
        inline_keyboard: m.choices.map((c) => [{ text: c.label, callback_data: `c:${c.id}` }]),
      };
    if (m.type === 'media' && m.mediaUrl) {
      const type = m.mediaType ?? 'image',
        key = type === 'image' ? 'photo' : type;
      method = `send${key[0]!.toUpperCase()}${key.slice(1)}`;
      delete body.text;
      body[key] = m.mediaUrl;
      body.caption = m.text;
    }
    const result = z
      .object({ message_id: z.number() })
      .parse(await this.transport.call(method, this.credentials.token, body));
    return { externalId: String(result.message_id), status: 'sent' as const };
  }
  interpretStatus() {
    return undefined;
  }
}
export class FakeTelegramTransport implements TelegramTransport {
  readonly calls: { method: string; body: Record<string, unknown> }[] = [];
  fail?: string;
  async call(method: string, _token: string, body: Record<string, unknown>) {
    this.calls.push({ method, body });
    if (this.fail) throw new ChannelError(this.fail);
    return method === 'getMe'
      ? { id: 123, is_bot: true, username: 'bothub_test_bot' }
      : method === 'setWebhook'
        ? true
        : { message_id: this.calls.length };
  }
}
