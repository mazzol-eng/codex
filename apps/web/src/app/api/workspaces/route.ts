import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { workspaceSchema } from '@/lib/validation';
import { createWorkspace, listWorkspaces, authorizeWorkspace } from '@bothub/db';
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  return NextResponse.json(await listWorkspaces(session.user.id), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin !== new URL(process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').origin)
    return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  const parsed = workspaceSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: 'Revise os dados da empresa.' }, { status: 400 });
  const existing = await listWorkspaces(session.user.id);
  if (existing.length >= 5)
    return NextResponse.json(
      { error: 'Você já tem cinco empresas. Fale com o suporte.' },
      { status: 409 },
    );
  const workspace = await createWorkspace(session.user.id, parsed.data);
  const response = NextResponse.json({ id: workspace.id }, { status: 201 });
  response.cookies.set('workspace-id', workspace.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return response;
}
export async function PATCH(request: Request) {
  if (
    request.headers.get('origin') !==
    new URL(process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').origin
  )
    return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const selection = z.object({ workspaceId: z.string().min(1).max(80) }).safeParse(body);
  if (!selection.success) return NextResponse.json({ error: 'Empresa inválida.' }, { status: 400 });
  try {
    await authorizeWorkspace(session.user.id, selection.data.workspaceId);
  } catch {
    return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set('workspace-id', selection.data.workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return response;
}
