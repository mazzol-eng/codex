import { z } from 'zod';
import { getBot, saveDraft, publishBot, restoreVersion, updateBot } from '@bothub/runtime';
import { graphSchema } from '@bothub/flow-engine';
import { apiContext, handleApi, readJson } from '@/lib/product-api';
type Context = { params: Promise<{ botId: string }> };
export async function GET(request: Request, context: Context) {
  return handleApi(async () => {
    const c = await apiContext(request),
      { botId } = await context.params;
    return getBot(c.userId, c.workspaceId, botId);
  });
}
const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save'),
    graph: graphSchema,
    revision: z.number().int().nonnegative(),
  }),
  z.object({ action: z.literal('publish'), revision: z.number().int().nonnegative() }),
  z.object({
    action: z.literal('restore'),
    versionId: z.string().max(80),
    revision: z.number().int().nonnegative(),
  }),
  z.object({
    action: z.literal('update'),
    name: z.string().trim().min(2).max(80).optional(),
    status: z.enum(['active', 'paused', 'archived']).optional(),
    settings: z
      .object({
        fallback: z.string().max(500),
        welcome: z.string().max(500).optional(),
        businessHours: z.string().max(200).optional(),
      })
      .optional(),
  }),
]);
export async function PATCH(request: Request, context: Context) {
  return handleApi(async () => {
    const c = await apiContext(request, true),
      { botId } = await context.params,
      input = schema.parse(await readJson(request));
    if (input.action === 'save')
      return saveDraft(c.userId, c.workspaceId, botId, input.graph, input.revision);
    if (input.action === 'publish')
      return publishBot(c.userId, c.workspaceId, botId, input.revision);
    if (input.action === 'restore')
      return restoreVersion(c.userId, c.workspaceId, botId, input.versionId, input.revision);
    const { action: _, ...fields } = input;
    void _;
    return updateBot(c.userId, c.workspaceId, botId, fields);
  });
}
