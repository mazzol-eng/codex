import { logger } from '@bothub/core';
import { db } from '@bothub/db';
import {
  processPending,
  enqueueDueSessions,
  enqueueConversationResume,
  processEvent,
  getQueue,
  processDueCampaigns,
} from '@bothub/runtime';
import { Worker } from 'bullmq';
let stopping = false,
  busy = false,
  worker: Worker | undefined;
if (process.env.QUEUE_MODE === 'redis') {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  worker = new Worker(
    'bothub',
    async (job) => {
      if (job.name === 'inbound') await processEvent(job.data.workspaceId, job.data.data.eventId);
      else if (job.name === 'resume')
        await enqueueConversationResume(job.data.workspaceId, job.data.data.conversationId);
      else throw new Error('Unsupported job type');
    },
    {
      connection: {
        host: url.hostname,
        port: Number(url.port || 6379),
        ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
        ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
        ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
        db: Number(url.pathname.slice(1) || 0),
      },
      concurrency: 4,
    },
  );
  worker.on('error', () =>
    logger.error(
      { service: 'worker', code: 'queue_error' },
      'Queue unavailable; durable outbox will retry',
    ),
  );
}
let lastSchedule = 0;
const tick = async () => {
  if (busy || stopping) return;
  busy = true;
  try {
    if (Date.now() - lastSchedule > 1000) {
      await enqueueDueSessions();
      await processDueCampaigns();
      lastSchedule = Date.now();
    }
    await processPending();
  } catch {
    logger.error({ service: 'worker', code: 'processing_error' }, 'Worker cycle failed');
  } finally {
    busy = false;
  }
};
const timer = setInterval(tick, 250);
await tick();
logger.info(
  { service: 'worker', phase: 3, queue: process.env.QUEUE_MODE ?? 'memory' },
  'Worker ready',
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, async () => {
    stopping = true;
    clearInterval(timer);
    await worker?.close();
    await getQueue().close();
    await db.$disconnect();
    process.exit(0);
  });
