import { describe, it, expect } from 'vitest';
import { encryptCredential, decryptCredential } from './security';
import { MemoryQueue } from './queue';
describe('credential encryption', () => {
  it('round trips without plaintext and rejects tampering', () => {
    const key = 'ab'.repeat(32);
    const encrypted = encryptCredential('secret-token', key);
    expect(encrypted).not.toContain('secret-token');
    expect(decryptCredential(encrypted, key)).toBe('secret-token');
    expect(() => decryptCredential(encrypted, 'cd'.repeat(32))).toThrow();
  });
  it('requires a 256-bit key', () => {
    expect(() => encryptCredential('x', 'bad')).toThrow();
  });
});
it('deduplicates jobs and retains workspace scope', async () => {
  const queue = new MemoryQueue();
  await queue.enqueue('one', { workspaceId: 'a', type: 'inbound', data: {} });
  await queue.enqueue('one', { workspaceId: 'b', type: 'inbound', data: {} });
  await queue.enqueue('one', { workspaceId: 'a', type: 'inbound', data: {} });
  expect(queue.jobs.size).toBe(2);
  expect([...queue.jobs.values()].map((job) => job.payload.workspaceId)).toEqual(['a', 'b']);
  await queue.close();
  expect(queue.jobs.size).toBe(0);
});
