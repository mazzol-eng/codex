import { exportContacts } from '@bothub/runtime';
import { apiContext, handleApi } from '@/lib/product-api';
import { filtersFromRequest } from '@/lib/contact-api';
export async function GET(request: Request) {
  let csv: string | undefined;
  const result = await handleApi(async () => {
    const c = await apiContext(request);
    csv = await exportContacts(c.userId, c.workspaceId, filtersFromRequest(request));
    return {};
  });
  return csv === undefined
    ? result
    : new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="contatos-bothub.csv"',
          'Cache-Control': 'no-store',
        },
      });
}
