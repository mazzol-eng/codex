import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDashboard, AccessDenied } from '@bothub/db';
import { z } from 'zod';
const query = z.object({
  workspaceId: z.string().min(1).max(80),
  days: z.coerce
    .number()
    .refine((n) => [7, 14, 30].includes(n))
    .default(7),
});
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Filtro inválido.' }, { status: 400 });
  try {
    return NextResponse.json(
      await getDashboard(session.user.id, parsed.data.workspaceId, parsed.data.days),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (error instanceof AccessDenied)
      return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });
    return NextResponse.json({ error: 'Não foi possível carregar os dados.' }, { status: 503 });
  }
}
