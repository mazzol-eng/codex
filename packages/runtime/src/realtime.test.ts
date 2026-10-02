import { it, expect } from 'vitest';
import { MemoryRealtime } from './realtime';
it('isolates realtime subscriptions by workspace and removes listeners', async () => {
  const port = new MemoryRealtime();
  let a = 0,
    b = 0;
  const remove = await port.subscribe('a', () => a++);
  await port.subscribe('b', () => b++);
  await port.publish('a');
  expect(a).toBe(1);
  expect(b).toBe(0);
  remove();
  await port.publish('a');
  expect(a).toBe(1);
  await port.publish('b');
  expect(b).toBe(1);
});
