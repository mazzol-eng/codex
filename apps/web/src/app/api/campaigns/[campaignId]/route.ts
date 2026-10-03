import { z } from 'zod';
import { getCampaign, activateCampaign, cancelCampaign } from '@bothub/runtime';
import { apiContext, handleApi, readJson } from '@/lib/product-api';
type Context = { params: Promise<{ campaignId: string }> };
export async function GET(request: Request, { params }: Context) {
  return handleApi(async () => {
    const c = await apiContext(request);
    return getCampaign(c.userId, c.workspaceId, (await params).campaignId);
  });
}
export async function POST(request: Request, { params }: Context) {
  return handleApi(async () => {
    const c = await apiContext(request, true),
      id = (await params).campaignId;
    const value = z
      .discriminatedUnion('action', [
        z
          .object({
            action: z.literal('start'),
            digest: z.string().regex(/^[a-f0-9]{64}$/),
            scheduledAt: z.string().datetime().optional(),
          })
          .strict(),
        z.object({ action: z.literal('cancel') }).strict(),
      ])
      .parse(await readJson(request, 1000));
    return value.action === 'cancel'
      ? cancelCampaign(c.userId, c.workspaceId, id)
      : activateCampaign(c.userId, c.workspaceId, id, value.digest, value.scheduledAt);
  });
}
