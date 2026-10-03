import { previewCampaign, campaignInputSchema } from '@bothub/runtime';
import { apiContext, handleApi, readJson } from '@/lib/product-api';
export async function POST(request: Request) {
  return handleApi(async () => {
    const c = await apiContext(request, true);
    return previewCampaign(
      c.userId,
      c.workspaceId,
      campaignInputSchema.parse(await readJson(request, 20000)),
    );
  });
}
