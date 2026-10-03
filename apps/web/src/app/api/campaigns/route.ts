import { listCampaigns, createCampaign, campaignInputSchema } from '@bothub/runtime';
import { apiContext, handleApi, readJson } from '@/lib/product-api';
export async function GET(request: Request) {
  return handleApi(async () => {
    const c = await apiContext(request);
    return listCampaigns(c.userId, c.workspaceId);
  });
}
export async function POST(request: Request) {
  return handleApi(async () => {
    const c = await apiContext(request, true);
    return createCampaign(
      c.userId,
      c.workspaceId,
      campaignInputSchema.parse(await readJson(request, 20000)),
    );
  }, 201);
}
