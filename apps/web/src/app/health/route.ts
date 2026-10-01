import { db } from '@bothub/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { status: 'ok', service: 'bothub-web', database: 'ok', phase: 1 },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ status: 'degraded', database: 'unavailable' }, { status: 503 });
  }
}
