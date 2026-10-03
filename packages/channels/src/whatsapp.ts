import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ChannelError } from './adapters';
import { providerRequest } from './provider-http';
import {
  degradeMessage,
  type ChannelAdapter,
  type InboundEvent,
  type OutboundMessage,
  type ChannelStatus,
} from './index';
export interface WhatsAppCredentials {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  verifyToken: string;
  appSecret: string;
  apiVersion?: string;
}
export interface WhatsAppTransport {
  request(
    method: 'GET' | 'POST',
    path: string,
    credentials: WhatsAppCredentials,
    body?: Record<string, unknown>,
  ): Promise<unknown>;
}
export class WhatsAppHttpTransport implements WhatsAppTransport {
  async request(
    method: 'GET' | 'POST',
    path: string,
    c: WhatsAppCredentials,
    body?: Record<string, unknown>,
  ) {
    const version = c.apiVersion ?? process.env.META_GRAPH_VERSION ?? 'v23.0';
    if (!/^v\d{2}\.\d+$/.test(version) || !/^\d+$/.test(c.phoneNumberId) || !/^\d+$/.test(c.wabaId))
      throw new ChannelError('credentials_invalid');
    return providerRequest(`https://graph.facebook.com/${version}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${c.accessToken}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
}
const message = z.object({
  id: z.string().max(300),
  from: z.string().regex(/^\d{5,15}$/),
  timestamp: z.string().regex(/^\d{1,11}$/),
  type: z.string(),
  text: z.object({ body: z.string().max(10000) }).optional(),
  interactive: z
    .object({
      type: z.string(),
      button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
      list_reply: z.object({ id: z.string(), title: z.string() }).optional(),
    })
    .optional(),
  button: z.object({ text: z.string(), payload: z.string() }).optional(),
  image: z.object({ id: z.string(), caption: z.string().optional() }).optional(),
  video: z.object({ id: z.string(), caption: z.string().optional() }).optional(),
  audio: z.object({ id: z.string() }).optional(),
  document: z.object({ id: z.string(), caption: z.string().optional() }).optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
});
const payload = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            metadata: z.object({ phone_number_id: z.string() }),
            contacts: z
              .array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string() }) }))
              .optional(),
            messages: z.array(message).optional(),
            statuses: z
              .array(
                z.object({
                  id: z.string(),
                  status: z.string(),
                  timestamp: z.string().regex(/^\d{1,11}$/),
                }),
              )
              .optional(),
          }),
        }),
      ),
    }),
  ),
});
export function whatsappPhoneIds(body: unknown) {
  const p = payload.safeParse(body);
  return p.success
    ? [
        ...new Set(
          p.data.entry.flatMap((e) => e.changes.map((c) => c.value.metadata.phone_number_id)),
        ),
      ]
    : [];
}
export class WhatsAppAdapter implements ChannelAdapter {
  readonly channel = 'whatsapp' as const;
  readonly capabilities = { buttons: true, lists: true, media: true, readReceipts: true };
  constructor(
    readonly credentials: WhatsAppCredentials,
    readonly transport: WhatsAppTransport = new WhatsAppHttpTransport(),
  ) {}
  async validateCredentials() {
    try {
      const p = z
        .object({ id: z.string() })
        .parse(
          await this.transport.request(
            'GET',
            `${this.credentials.phoneNumberId}?fields=id,display_phone_number`,
            this.credentials,
          ),
        );
      return p.id === this.credentials.phoneNumberId;
    } catch {
      return false;
    }
  }
  verifyWebhook(body: string, headers: Record<string, string>) {
    const signature = headers['x-hub-signature-256'] ?? '';
    if (!/^sha256=[a-f\d]{64}$/i.test(signature) || !this.credentials.appSecret) return false;
    return timingSafeEqual(
      Buffer.from(signature.slice(7), 'hex'),
      createHmac('sha256', this.credentials.appSecret).update(body).digest(),
    );
  }
  verifyChallenge(token: string) {
    const a = Buffer.from(token),
      b = Buffer.from(this.credentials.verifyToken);
    return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
  }
  async subscribeApp() {
    await this.transport.request(
      'POST',
      `${this.credentials.wabaId}/subscribed_apps`,
      this.credentials,
      {},
    );
  }
  private changes(body: unknown) {
    const p = payload.safeParse(body);
    return p.success
      ? p.data.entry
          .flatMap((e) => e.changes)
          .map((c) => c.value)
          .filter((c) => c.metadata.phone_number_id === this.credentials.phoneNumberId)
      : [];
  }
  normalize(body: unknown, connectionId: string): InboundEvent[] {
    return this.changes(body).flatMap((value) =>
      (value.messages ?? []).flatMap((m) => {
        const reply = m.interactive?.button_reply ?? m.interactive?.list_reply ?? m.button;
        const media = m.image ?? m.video ?? m.audio ?? m.document;
        if (
          ![
            'text',
            'interactive',
            'button',
            'image',
            'video',
            'audio',
            'document',
            'location',
          ].includes(m.type)
        )
          return [];
        const timestamp = new Date(Number(m.timestamp) * 1000);
        if (!Number.isFinite(timestamp.getTime())) return [];
        return [
          {
            channel: this.channel,
            connectionId,
            externalContactId: m.from,
            externalMessageId: m.id,
            type: reply
              ? m.interactive?.list_reply
                ? 'list_reply'
                : 'button_reply'
              : media
                ? 'media'
                : m.location
                  ? 'location'
                  : 'text',
            text:
              m.text?.body ??
              m.interactive?.button_reply?.title ??
              m.interactive?.list_reply?.title ??
              m.button?.text ??
              m.image?.caption ??
              m.video?.caption ??
              m.document?.caption,
            payload: reply
              ? 'id' in reply
                ? reply.id
                : reply.payload
              : (m.location ?? (media ? { fileId: media.id } : undefined)),
            timestamp: timestamp.toISOString(),
            contactName: value.contacts?.find((c) => c.wa_id === m.from)?.profile.name,
          },
        ];
      }),
    );
  }
  normalizeStatuses(body: unknown): ChannelStatus[] {
    return this.changes(body).flatMap((c) =>
      (c.statuses ?? []).flatMap((s) => {
        const status = this.interpretStatus(s);
        const date = new Date(Number(s.timestamp) * 1000);
        return status && Number.isFinite(date.getTime())
          ? [{ externalMessageId: s.id, status, timestamp: date.toISOString() }]
          : [];
      }),
    );
  }
  interpretStatus(body: unknown) {
    const s = (body as { status?: unknown })?.status;
    return s === 'sent' || s === 'delivered' || s === 'read' || s === 'failed' ? s : undefined;
  }
  async send(contactId: string, message: OutboundMessage) {
    const m = degradeMessage(this.channel, message);
    const body: Record<string, unknown> = { messaging_product: 'whatsapp', to: contactId };
    if (m.templateName) {
      body.type = 'template';
      body.template = {
        name: m.templateName,
        language: { code: m.templateLanguage ?? 'pt_BR' },
        ...(m.templateParameters?.length
          ? {
              components: [
                {
                  type: 'body',
                  parameters: m.templateParameters.map((text) => ({ type: 'text', text })),
                },
              ],
            }
          : {}),
      };
    } else if (m.type === 'media' && m.mediaUrl) {
      body.type = m.mediaType ?? 'image';
      body[String(body.type)] = {
        link: m.mediaUrl,
        ...(body.type === 'audio' ? {} : { caption: m.text }),
      };
    } else if (m.choices?.length) {
      if (m.text.length > 1024 || m.choices.length > 10)
        throw new ChannelError('message_limits_exceeded');
      body.type = 'interactive';
      body.interactive =
        m.type === 'list'
          ? {
              type: 'list',
              body: { text: m.text },
              action: {
                button: 'Escolher opção',
                sections: [
                  { rows: m.choices.map((c) => ({ id: c.id, title: c.label.slice(0, 24) })) },
                ],
              },
            }
          : {
              type: 'button',
              body: { text: m.text },
              action: {
                buttons: m.choices.map((c) => ({
                  type: 'reply',
                  reply: { id: c.id, title: c.label.slice(0, 20) },
                })),
              },
            };
    } else {
      body.type = 'text';
      body.text = { body: m.text };
    }
    const result = z
      .object({ messages: z.array(z.object({ id: z.string() })).min(1) })
      .parse(
        await this.transport.request(
          'POST',
          `${this.credentials.phoneNumberId}/messages`,
          this.credentials,
          body,
        ),
      );
    return { externalId: result.messages[0]!.id, status: 'sent' as const };
  }
}
export class FakeWhatsAppTransport implements WhatsAppTransport {
  readonly calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  templates: {
    id: string;
    name: string;
    language: string;
    category: string;
    status: string;
    components: unknown[];
  }[] = [];
  fail?: string;
  async request(
    method: 'GET' | 'POST',
    path: string,
    c: WhatsAppCredentials,
    body?: Record<string, unknown>,
  ) {
    this.calls.push({ method, path, body });
    if (this.fail) throw new ChannelError(this.fail);
    if (path.includes('message_templates')) {
      if (method === 'GET') return { data: this.templates };
      const t = {
        id: randomUUID(),
        name: String(body?.name),
        language: String(body?.language),
        category: String(body?.category),
        status: 'APPROVED',
        components: body?.components as unknown[],
      };
      this.templates.push(t);
      return { id: t.id, status: t.status };
    }
    return method === 'GET'
      ? { id: c.phoneNumberId, display_phone_number: '+55 11 99999-0000' }
      : { messages: [{ id: `wamid.${randomUUID()}` }] };
  }
}
