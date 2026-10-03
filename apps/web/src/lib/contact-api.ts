import { z } from 'zod';
import { contactFiltersSchema } from '@bothub/runtime';
export function filtersFromRequest(request: Request) {
  const q = new URL(request.url).searchParams;
  return contactFiltersSchema.parse({
    search: q.get('search') || undefined,
    tag: q.get('tag') || undefined,
    channel: q.get('channel') || undefined,
    consent: q.has('consent')
      ? z.enum(['true', 'false']).parse(q.get('consent')) === 'true'
      : undefined,
    marketingConsent: q.has('marketingConsent')
      ? z.enum(['true', 'false']).parse(q.get('marketingConsent')) === 'true'
      : undefined,
  });
}
