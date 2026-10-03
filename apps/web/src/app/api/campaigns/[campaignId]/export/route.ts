import { exportCampaign } from '@bothub/runtime';
import { apiContext, handleApi } from '@/lib/product-api';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  let csv: string | undefined;
  const result = await handleApi(async () => {
    const c = await apiContext(request);
    csv = await exportCampaign(c.userId, c.workspaceId, (await params).campaignId);
    return {};
  });
  return csv === undefined
    ? result
    : new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="campanha-bothub.csv"',
          'Cache-Control': 'no-store',
        },
      });
}
