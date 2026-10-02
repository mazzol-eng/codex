import { Redis } from 'ioredis';
export interface RealtimePort {
  publish(workspaceId: string): Promise<void>;
  subscribe(workspaceId: string, callback: () => void): Promise<() => void>;
}
export class MemoryRealtime implements RealtimePort {
  private listeners = new Map<string, Set<() => void>>();
  async publish(id: string) {
    this.listeners.get(id)?.forEach((fn) => fn());
  }
  async subscribe(id: string, fn: () => void) {
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(fn);
    return () => {
      set?.delete(fn);
      if (!set?.size) this.listeners.delete(id);
    };
  }
}
export class RedisRealtime implements RealtimePort {
  private publisher: Redis;
  constructor(private url: string) {
    this.publisher = new Redis(url, { maxRetriesPerRequest: 1 });
    this.publisher.on('error', () => {});
  }
  async publish(id: string) {
    await this.publisher.publish(`bothub:inbox:${id}`, 'changed');
  }
  async subscribe(id: string, fn: () => void) {
    const subscriber = new Redis(this.url, { maxRetriesPerRequest: 1 });
    subscriber.on('error', () => {});
    subscriber.on('message', fn);
    try {
      await subscriber.subscribe(`bothub:inbox:${id}`);
    } catch (error) {
      subscriber.disconnect();
      throw error;
    }
    return () => {
      subscriber.disconnect();
    };
  }
}
let realtime: RealtimePort | undefined;
export function getRealtime() {
  return (realtime ??=
    process.env.QUEUE_MODE === 'redis'
      ? new RedisRealtime(process.env.REDIS_URL ?? 'redis://localhost:6379')
      : new MemoryRealtime());
}
export async function notify(workspaceId: string) {
  await getRealtime()
    .publish(workspaceId)
    .catch(() => {});
}
