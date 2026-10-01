import { Queue } from 'bullmq';
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
    if (!this.jobs.has(id)) this.jobs.set(id, { payload, runAt: Date.now() + delay });
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
      },
    });
  }
  async enqueue(id: string, payload: JobPayload, delay = 0) {
    await this.queue.add(payload.type, payload, {
      jobId: id,
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
