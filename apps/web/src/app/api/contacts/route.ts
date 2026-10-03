import { z } from 'zod';
import { listContacts, createContact, contactInputSchema } from '@bothub/runtime';
import { apiContext, handleApi, readJson } from '@/lib/product-api';
import { filtersFromRequest } from '@/lib/contact-api';
export async function GET(request: Request) {
  return handleApi(async () => {
    const c = await apiContext(request);
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(1000)
      .parse(new URL(request.url).searchParams.get('page') ?? 1);
    return listContacts(c.userId, c.workspaceId, filtersFromRequest(request), page);
  });
}
export async function POST(request: Request) {
  return handleApi(async () => {
    const c = await apiContext(request, true);
    return createContact(
      c.userId,
      c.workspaceId,
      contactInputSchema.parse(await readJson(request, 20000)),
    );
  }, 201);
}
