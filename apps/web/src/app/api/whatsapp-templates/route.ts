import { z } from 'zod';
import {
  listWhatsAppTemplates,
  createWhatsAppTemplate,
  syncWhatsAppTemplates,
  whatsappTemplateSchema,
} from '@bothub/runtime';
import { apiContext, handleApi, readJson } from '@/lib/product-api';
export async function GET(request: Request) {
  return handleApi(async () => {
    const c = await apiContext(request);
    return listWhatsAppTemplates(
      c.userId,
      c.workspaceId,
      new URL(request.url).searchParams.get('connectionId') ?? undefined,
    );
  });
}
export async function POST(request: Request) {
  return handleApi(async () => {
    const c = await apiContext(request, true);
    return createWhatsAppTemplate(
      c.userId,
      c.workspaceId,
      whatsappTemplateSchema.parse(await readJson(request, 20000)),
    );
  }, 201);
}
export async function PATCH(request: Request) {
  return handleApi(async () => {
    const c = await apiContext(request, true);
    const input = z
      .object({ connectionId: z.string().min(1).max(80) })
      .strict()
      .parse(await readJson(request, 5000));
    return syncWhatsAppTemplates(c.userId, c.workspaceId, input.connectionId);
  });
}
