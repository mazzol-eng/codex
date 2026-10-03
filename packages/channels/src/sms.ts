import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ChannelError } from './adapters';
import { providerRequest } from './provider-http';
import {
  degradeMessage,
  type ChannelAdapter,
  type ChannelStatus,
  type InboundEvent,
  type OutboundMessage,
} from './index';
export interface SmsCredentials {
  accountSid: string;
  authToken: string;
  from?: string;
  messagingServiceSid?: string;
  statusCallback?: string;
}
export interface SmsProvider {
  validate(credentials: SmsCredentials): Promise<boolean>;
  send(credentials: SmsCredentials, to: string, text: string): Promise<{ id: string }>;
  configure(credentials: SmsCredentials, url: string): Promise<void>;
  verify(credentials: SmsCredentials, url: string, body: string, signature: string): boolean;
}
export function twilioSignature(token: string, url: string, body: string) {
  const params = new URLSearchParams(body);
  let data = url;
  for (const key of [...new Set(params.keys())].sort())
    for (const value of [...new Set(params.getAll(key))].sort()) data += key + value;
  return createHmac('sha1', token).update(data).digest('base64');
}
export class TwilioSmsProvider implements SmsProvider {
  private async request(c: SmsCredentials, path: string, body?: Record<string, string>) {
    if (!/^AC[a-f\d]{32}$/i.test(c.accountSid)) throw new ChannelError('credentials_invalid');
    return providerRequest(`https://api.twilio.com/2010-04-01/Accounts/${c.accountSid}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${c.accountSid}:${c.authToken}`).toString('base64')}`,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      ...(body ? { body: new URLSearchParams(body).toString() } : {}),
    });
  }
  async validate(c: SmsCredentials) {
    try {
      const result = z
        .object({ sid: z.string(), status: z.string() })
        .parse(await this.request(c, '.json'));
      return result.sid === c.accountSid && result.status === 'active';
    } catch {
      return false;
    }
  }
  async send(c: SmsCredentials, to: string, text: string) {
    const p = z.object({ sid: z.string() }).parse(
      await this.request(c, '/Messages.json', {
        To: to,
        Body: text,
        ...(c.messagingServiceSid
          ? { MessagingServiceSid: c.messagingServiceSid }
          : { From: c.from ?? '' }),
        ...(c.statusCallback ? { StatusCallback: c.statusCallback } : {}),
      }),
    );
    return { id: p.sid };
  }
  async configure(c: SmsCredentials, url: string) {
    if (c.messagingServiceSid) {
      await providerRequest(`https://messaging.twilio.com/v1/Services/${c.messagingServiceSid}`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${c.accountSid}:${c.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          InboundRequestUrl: url,
          InboundMethod: 'POST',
          StatusCallback: `${url}/status`,
        }).toString(),
      });
      return;
    }
    const list = z
      .object({ incoming_phone_numbers: z.array(z.object({ sid: z.string() })) })
      .parse(
        await this.request(
          c,
          `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(c.from ?? '')}`,
        ),
      );
    if (!list.incoming_phone_numbers.length) throw new ChannelError('phone_number_not_found');
    await this.request(c, `/IncomingPhoneNumbers/${list.incoming_phone_numbers[0]!.sid}.json`, {
      SmsUrl: url,
      SmsMethod: 'POST',
    });
  }
  verify(c: SmsCredentials, url: string, body: string, signature: string) {
    const a = Buffer.from(signature),
      b = Buffer.from(twilioSignature(c.authToken, url, body));
    return !!c.authToken && a.length === b.length && timingSafeEqual(a, b);
  }
}
export class SmsAdapter implements ChannelAdapter {
  readonly channel = 'sms' as const;
  readonly capabilities = { buttons: false, lists: false, media: false, readReceipts: false };
  constructor(
    readonly credentials: SmsCredentials,
    readonly provider: SmsProvider = new TwilioSmsProvider(),
  ) {}
  validateCredentials() {
    return this.provider.validate(this.credentials);
  }
  verifyWebhook(body: string, headers: Record<string, string>) {
    return this.provider.verify(
      this.credentials,
      headers['x-bothub-webhook-url'] ?? '',
      body,
      headers['x-twilio-signature'] ?? '',
    );
  }
  normalize(body: unknown, connectionId: string): InboundEvent[] {
    const p = z
      .object({
        AccountSid: z.literal(this.credentials.accountSid),
        MessageSid: z.string().regex(/^SM[a-f\d]{32}$/i),
        From: z.string().regex(/^\+[1-9]\d{6,14}$/),
        Body: z.string().max(10000).optional(),
        NumMedia: z.string().optional(),
        MediaUrl0: z.string().url().optional(),
      })
      .safeParse(body);
    if (!p.success) return [];
    return [
      {
        channel: this.channel,
        connectionId,
        externalContactId: p.data.From,
        externalMessageId: p.data.MessageSid,
        type: Number(p.data.NumMedia) > 0 ? 'media' : 'text',
        text: p.data.Body,
        payload: p.data.MediaUrl0 ? { mediaUrl: p.data.MediaUrl0 } : undefined,
        timestamp: new Date().toISOString(),
      },
    ];
  }
  normalizeStatuses(body: unknown): ChannelStatus[] {
    const p = z
      .object({
        AccountSid: z.literal(this.credentials.accountSid),
        MessageSid: z.string(),
        MessageStatus: z.string(),
      })
      .safeParse(body);
    if (!p.success) return [];
    const status = this.interpretStatus(p.data);
    return status
      ? [{ externalMessageId: p.data.MessageSid, status, timestamp: new Date().toISOString() }]
      : [];
  }
  interpretStatus(body: unknown) {
    const s = (body as { MessageStatus?: unknown })?.MessageStatus;
    return s === 'delivered'
      ? ('delivered' as const)
      : s === 'failed' || s === 'undelivered'
        ? ('failed' as const)
        : ['queued', 'accepted', 'sending', 'sent'].includes(String(s))
          ? ('sent' as const)
          : undefined;
  }
  async send(contactId: string, message: OutboundMessage) {
    const m = degradeMessage(this.channel, message);
    const result = await this.provider.send(
      this.credentials,
      contactId,
      m.mediaUrl ? `${m.text}\n${m.mediaUrl}` : m.text,
    );
    return { externalId: result.id, status: 'sent' as const };
  }
}
export class FakeSmsProvider extends TwilioSmsProvider {
  readonly calls: { to: string; text: string }[] = [];
  fail?: string;
  override async validate() {
    return true;
  }
  override async configure() {}
  override async send(_c: SmsCredentials, to: string, text: string) {
    if (this.fail) throw new ChannelError(this.fail);
    this.calls.push({ to, text });
    return { id: `SM${randomUUID().replaceAll('-', '')}` };
  }
}
