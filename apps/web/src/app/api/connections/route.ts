import { z } from 'zod';
import { listConnections, createConnection } from '@bothub/runtime';
import { apiContext, handleApi, readJson } from '@/lib/product-api';
export async function GET(request: Request) {
  return handleApi(async () => {
    const c = await apiContext(request);
    return listConnections(c.userId, c.workspaceId);
  });
}
export async function POST(request: Request) {
  return handleApi(async () => {
    const c = await apiContext(request, true);
    const input = z
      .object({
        channel: z.enum(['simulator', 'telegram']),
        name: z.string().trim().min(2).max(80),
        botId: z.string().min(1).max(80),
        token: z
          .string()
          .regex(/^\d{5,20}:[A-Za-z0-9_-]{20,120}$/)
          .optional(),
      })
      .strict()
      .parse(await readJson(request, 5000));
    return createConnection(c.userId, c.workspaceId, input);
  }, 201);
}
