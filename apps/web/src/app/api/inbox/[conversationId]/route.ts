import { z } from 'zod';
import { getConversation, actOnConversation } from '@bothub/runtime';
import { apiContext, handleApi, readJson } from '@/lib/product-api';
type Context = { params: Promise<{ conversationId: string }> };
export async function GET(request: Request, context: Context) {
  return handleApi(async () => {
    const c = await apiContext(request),
      { conversationId } = await context.params;
    return getConversation(c.userId, c.workspaceId, conversationId);
  });
}
export async function POST(request: Request, context: Context) {
  return handleApi(async () => {
    const c = await apiContext(request, true),
      { conversationId } = await context.params,
      input = z
        .object({
          action: z.enum(['take', 'return', 'close', 'reply', 'note', 'read']),
          text: z.string().trim().min(1).max(2000).optional(),
        })
        .strict()
        .parse(await readJson(request, 5000));
    return actOnConversation(c.userId, c.workspaceId, conversationId, input);
  });
}
