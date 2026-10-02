import { listConversations } from '@bothub/runtime';
import { apiContext, handleApi } from '@/lib/product-api';
export async function GET(request: Request) {
  return handleApi(async () => {
    const c = await apiContext(request);
    return listConversations(c.userId, c.workspaceId);
  });
}
