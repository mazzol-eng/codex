import { z } from 'zod';
import { listBots, createBot } from '@bothub/runtime';
import { apiContext, handleApi, readJson } from '@/lib/product-api';
export async function GET(request: Request) {
  return handleApi(async () => {
    const c = await apiContext(request);
    return listBots(c.userId, c.workspaceId);
  });
}
export async function POST(request: Request) {
  return handleApi(async () => {
    const c = await apiContext(request, true);
    const input = z
      .object({
        name: z.string().trim().min(2).max(80),
        templateId: z.string().max(40).optional(),
        duplicateId: z.string().max(80).optional(),
      })
      .strict()
      .parse(await readJson(request));
    return createBot(c.userId, c.workspaceId, input);
  }, 201);
}
