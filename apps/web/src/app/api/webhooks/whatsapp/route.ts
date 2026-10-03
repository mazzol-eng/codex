import { db } from '@bothub/db';
import { adapterFor, ingest, ingestStatus, verificationHash } from '@bothub/runtime';
import { WhatsAppAdapter, whatsappPhoneIds } from '@bothub/channels/adapters';
import { rawWebhookBody, webhookRateAllowed } from '@/lib/channel-webhooks';
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams,
    token = q.get('hub.verify_token') ?? '',
    challenge = q.get('hub.challenge') ?? '';
  if (q.get('hub.mode') !== 'subscribe' || token.length > 100 || !/^\d{1,100}$/.test(challenge))
    return new Response(null, { status: 403 });
  const c = await db.connection.findUnique({
    where: { verificationHash: verificationHash(token) },
  });
  if (
    !c ||
    c.channel !== 'whatsapp' ||
    c.mode === 'fake' ||
    !(adapterFor(c) as WhatsAppAdapter).verifyChallenge(token)
  )
    return new Response(null, { status: 403 });
  await db.connection.updateMany({
    where: { workspaceId: c.workspaceId, id: c.id },
    data: { status: 'connected' },
  });
  return new Response(challenge, {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}
export async function POST(request: Request) {
  try {
    const body = await rawWebhookBody(request);
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response(null, { status: 400 });
    }
    const ids = whatsappPhoneIds(payload);
    if (ids.length > 100) return new Response(null, { status: 413 });
    if (!ids.length) return new Response(null, { status: 400 });
    const connections = await db.connection.findMany({
      where: { channel: 'whatsapp', mode: 'real', externalAccountId: { in: ids } },
    });
    if (!connections.length) return new Response(null, { status: 404 });
    for (const c of connections) {
      if (!webhookRateAllowed(c.id)) return new Response(null, { status: 429 });
      if (
        !adapterFor(c).verifyWebhook(body, {
          'x-hub-signature-256': request.headers.get('x-hub-signature-256') ?? '',
        })
      )
        return new Response(null, { status: 401 });
    }
    for (const c of connections) {
      const adapter = adapterFor(c);
      for (const e of adapter.normalize(payload, c.id)) await ingest(c, e);
      for (const s of adapter.normalizeStatuses?.(payload) ?? []) await ingestStatus(c, s);
    }
    return Response.json({ ok: true });
  } catch (e) {
    return new Response(null, {
      status: e instanceof Error && e.message === 'body_limit' ? 413 : 503,
    });
  }
}
