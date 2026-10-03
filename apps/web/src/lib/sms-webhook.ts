import { db } from '@bothub/db';
import { adapterFor, ingest, ingestStatus } from '@bothub/runtime';
import { rawWebhookBody, webhookRateAllowed } from './channel-webhooks';
export async function smsWebhook(request: Request, connectionId: string, status = false) {
  if (!webhookRateAllowed(connectionId)) return new Response(null, { status: 429 });
  const c = await db.connection.findUnique({ where: { id: connectionId } });
  if (!c || c.channel !== 'sms' || c.mode === 'fake') return new Response(null, { status: 404 });
  try {
    const body = await rawWebhookBody(request, 50000),
      adapter = adapterFor(c),
      base = process.env.PUBLIC_WEBHOOK_URL;
    if (!base?.startsWith('https://')) return new Response(null, { status: 503 });
    const url = `${base.replace(/\/$/, '')}/api/webhooks/sms/${connectionId}${status ? '/status' : ''}${new URL(request.url).search}`;
    if (
      !adapter.verifyWebhook(body, {
        'x-bothub-webhook-url': url,
        'x-twilio-signature': request.headers.get('x-twilio-signature') ?? '',
      })
    )
      return new Response(null, { status: 401 });
    const payload = Object.fromEntries(new URLSearchParams(body));
    if (status)
      for (const s of adapter.normalizeStatuses?.(payload) ?? []) await ingestStatus(c, s);
    else for (const event of adapter.normalize(payload, c.id)) await ingest(c, event);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (e) {
    return new Response(null, {
      status: e instanceof Error && e.message === 'body_limit' ? 413 : 503,
    });
  }
}
