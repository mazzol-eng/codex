import { db } from '@bothub/db';
import { adapterFor, ingest } from '@bothub/runtime';
const buckets = new Map<string, { count: number; until: number }>();
export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await params;
  const now = Date.now();
  let bucket = buckets.get(connectionId);
  if (!bucket || bucket.until < now) {
    bucket = { count: 0, until: now + 60000 };
    buckets.set(connectionId, bucket);
  }
  if (++bucket.count > 240)
    return new Response(null, { status: 429, headers: { 'Retry-After': '60' } });
  if (buckets.size > 10000) for (const [id, b] of buckets) if (b.until < now) buckets.delete(id);
  const connection = await db.connection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.channel !== 'telegram' || !connection.credentialCiphertext)
    return new Response(null, { status: 404 });
  try {
    const adapter = adapterFor(connection);
    if (
      !adapter.verifyWebhook('', {
        'x-telegram-bot-api-secret-token':
          request.headers.get('x-telegram-bot-api-secret-token') ?? '',
      })
    )
      return new Response(null, { status: 401 });
    if (Number(request.headers.get('content-length') ?? 0) > 100000)
      return new Response(null, { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400 });
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 100000) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }
    const events = adapter.normalize(
      JSON.parse(Buffer.concat(chunks).toString('utf8')),
      connectionId,
    );
    for (const event of events) await ingest(connection, event);
    return Response.json({ ok: true });
  } catch {
    return new Response(null, { status: 503 });
  }
}
