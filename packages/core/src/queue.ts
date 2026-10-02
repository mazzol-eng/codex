import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { logger } from './logger';
function jobKey(id: string, workspaceId: string) {
  return createHash('sha256').update(`${workspaceId}\0${id}`).digest('hex');
}
export interface JobPayload {
  workspaceId: string;
  type: string;
  data: Record<string, unknown>;
}
export interface QueuePort {
  enqueue(id: string, payload: JobPayload, delay?: number): Promise<void>;
  close(): Promise<void>;
}
export class MemoryQueue implements QueuePort {
  readonly jobs = new Map<string, { payload: JobPayload; runAt: number }>();
  async enqueue(id: string, payload: JobPayload, delay = 0) {
    const key = jobKey(id, payload.workspaceId);
    if (!this.jobs.has(key)) this.jobs.set(key, { payload, runAt: Date.now() + delay });
  }
  async close() {
    this.jobs.clear();
  }
}
export class BullQueue implements QueuePort {
  private queue: Queue;
  constructor(redisUrl: string) {
    const url = new URL(redisUrl);
    this.queue = new Queue('bothub', {
      connection: {
        host: url.hostname,
        port: Number(url.port || 6379),
        ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
        ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
        ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
        db: Number(url.pathname.slice(1) || 0),
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      },
    });
    this.queue.on('error', () =>
      logger.error(
        { code: 'queue_unavailable' },
        'Queue unavailable; durable outbox retains events',
      ),
    );
  }
  async enqueue(id: string, payload: JobPayload, delay = 0) {
    await this.queue.add(payload.type, payload, {
      jobId: jobKey(id, payload.workspaceId),
      delay,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
  async close() {
    await this.queue.close();
  }
}
