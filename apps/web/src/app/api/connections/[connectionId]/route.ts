import { testConnection, connectionEvents } from '@bothub/runtime';
import { apiContext, handleApi } from '@/lib/product-api';
type Context = { params: Promise<{ connectionId: string }> };
export async function GET(request: Request, context: Context) {
  return handleApi(async () => {
    const c = await apiContext(request),
      { connectionId } = await context.params;
    return connectionEvents(c.userId, c.workspaceId, connectionId);
  });
}
export async function POST(request: Request, context: Context) {
  return handleApi(async () => {
    const c = await apiContext(request, true),
      { connectionId } = await context.params;
    return testConnection(c.userId, c.workspaceId, connectionId);
  });
}
