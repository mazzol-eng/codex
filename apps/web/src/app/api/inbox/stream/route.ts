import { apiContext, apiResponse } from '@/lib/product-api';
import { getRealtime } from '@bothub/runtime';
import { authorizeWorkspace } from '@bothub/db';
import { auth } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  let context;
  try {
    context = await apiContext(request);
  } catch {
    return apiResponse({ error: 'Sem acesso.' }, 403);
  }
  const { userId, workspaceId } = context;
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let unsubscribe: () => void = () => {};
      const lifecycle: { timer?: ReturnType<typeof setInterval> } = {};
      const send = () => {
        if (!closed) controller.enqueue(encoder.encode(`event: changed\ndata: {}\n\n`));
      };
      cleanup = () => {
        if (closed) return;
        closed = true;
        if (lifecycle.timer) clearInterval(lifecycle.timer);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      request.signal.addEventListener('abort', cleanup, { once: true });
      try {
        unsubscribe = await getRealtime().subscribe(workspaceId, send);
      } catch {}
      if (closed) {
        unsubscribe();
        return;
      }
      send();
      let checking = false;
      lifecycle.timer = setInterval(
        async () => {
          if (checking || closed) return;
          checking = true;
          try {
            const session = await auth.api.getSession({ headers: request.headers });
            if (!session || session.user.id !== userId) throw new Error('session_expired');
            await authorizeWorkspace(userId, workspaceId);
            send();
          } catch {
            cleanup();
          } finally {
            checking = false;
          }
        },
        process.env.QUEUE_MODE === 'redis' ? 15000 : 1500,
      );
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
