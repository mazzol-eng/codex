import { auth } from './auth';
import { db, authorizeWorkspace, AccessDenied } from '@bothub/db';
import { ProductError } from '@bothub/runtime';
import { cookies } from 'next/headers';
import { z } from 'zod';
export async function apiContext(request: Request, write = false) {
  if (
    write &&
    request.headers.get('origin') !==
      new URL(process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').origin
  )
    throw new ProductError('Origem inválida.', 403);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new ProductError('Entre na sua conta.', 401);
  const fromQuery = new URL(request.url).searchParams.get('workspaceId');
  const selected = fromQuery ?? (await cookies()).get('workspace-id')?.value;
  const workspaceId =
    selected ??
    (
      await db.membership.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'asc' },
      })
    )?.workspaceId;
  if (!workspaceId) throw new ProductError('Crie uma empresa para continuar.', 409);
  await authorizeWorkspace(session.user.id, workspaceId);
  return { userId: session.user.id, workspaceId };
}
export function apiResponse(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function handleApi(fn: () => Promise<unknown>, status = 200) {
  try {
    return apiResponse(await fn(), status);
  } catch (e) {
    if (e instanceof AccessDenied)
      return apiResponse({ error: 'Você não tem permissão para esta ação.' }, 403);
    if (e instanceof ProductError) return apiResponse({ error: e.message }, e.status);
    if (e instanceof z.ZodError)
      return apiResponse({ error: 'Revise os campos e tente novamente.' }, 400);
    return apiResponse({ error: 'Não foi possível concluir. Tente novamente.' }, 500);
  }
}
export async function readJson(request: Request, limit = 200000): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ProductError('Dados inválidos.');
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > limit) {
      await reader.cancel();
      throw new ProductError('Esta mensagem é muito grande.', 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ProductError('Dados inválidos.');
  }
}
