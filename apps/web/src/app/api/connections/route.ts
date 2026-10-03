import { listConnections, createConnection, connectionInputSchema } from '@bothub/runtime';
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
    const input = connectionInputSchema.parse(await readJson(request, 15000));
    return createConnection(c.userId, c.workspaceId, input);
  }, 201);
}
