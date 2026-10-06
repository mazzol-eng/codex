import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';
import { diagnosticOrigin } from '../../../../../../../config/cloud-preview';
const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;
export async function POST(request: Request) {
  const response = await handlers.POST(request);
  if (process.env.NODE_ENV !== 'development' || response.status !== 403) return response;
  try {
    const body: unknown = await response.clone().json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('code' in body) ||
      body.code !== 'INVALID_ORIGIN'
    )
      return response;
    const context = await auth.$context;
    const headers = new Headers(response.headers);
    headers.delete('Content-Length');
    headers.set('Cache-Control', 'no-store');
    return Response.json(
      {
        ...body,
        diagnostic: {
          expectedOrigin: diagnosticOrigin(context.baseURL),
          receivedOrigin: diagnosticOrigin(request.headers.get('origin')),
          requestOrigin: diagnosticOrigin(request.url),
        },
      },
      { status: 403, headers },
    );
  } catch {
    return response;
  }
}
