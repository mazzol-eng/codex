const buckets = new Map<string, { count: number; until: number }>();
let swept = 0;
export function webhookRateAllowed(key: string) {
  const now = Date.now();
  if (now - swept > 60000) {
    for (const [id, b] of buckets) if (b.until <= now) buckets.delete(id);
    swept = now;
  }
  let b = buckets.get(key);
  if (!b || b.until <= now) {
    if (buckets.size >= 10000) return false;
    b = { count: 0, until: now + 60000 };
    buckets.set(key, b);
  }
  return ++b.count <= 600;
}
export async function rawWebhookBody(request: Request, limit = 200000) {
  if (Number(request.headers.get('content-length') ?? 0) > limit) throw new Error('body_limit');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > limit) {
      await reader.cancel();
      throw new Error('body_limit');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
