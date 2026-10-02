import { z } from 'zod';
import { db, authorizeWorkspace, AccessDenied } from '@bothub/db';
import { ProductError, ingest } from '@bothub/runtime';
import { apiContext, handleApi, readJson } from '@/lib/product-api';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  return handleApi(async () => {
    const c = await apiContext(request, true);
    const m = await authorizeWorkspace(c.userId, c.workspaceId);
    if (m.role === 'viewer') throw new AccessDenied();
    const { connectionId } = await params;
    const connection = await db.connection.findFirst({
      where: {
        workspaceId: c.workspaceId,
        id: connectionId,
        channel: 'simulator',
        status: 'connected',
      },
    });
    if (!connection) throw new ProductError('Simulador não encontrado.', 404);
    const input = z
      .object({
        text: z.string().trim().min(1).max(2000),
        externalContactId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
        externalMessageId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
      })
      .strict()
      .parse(await readJson(request, 5000));
    const event = await ingest(connection, {
      ...input,
      channel: 'simulator',
      connectionId,
      type: 'text',
      timestamp: new Date().toISOString(),
      contactName: 'Cliente de teste',
    });
    return { id: event.id, status: event.status };
  }, 202);
}
