import { afterEach, it, expect, vi } from 'vitest';
import { FakeEmail, HttpEmail } from './email';
import { createLogger } from './logger';
afterEach(() => vi.unstubAllGlobals());
it('fake email delivers without making a network request', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const mail = new FakeEmail();
  await mail.send({ to: 'fixture@example.test', subject: 'Reset', text: 'Local-only link' });
  expect(mail.messages).toHaveLength(1);
  expect(fetch).not.toHaveBeenCalled();
});
it('real email adapter translates the message and reports delivery errors', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false });
  vi.stubGlobal('fetch', fetch);
  const mail = new HttpEmail(
    'https://email.example.test',
    'fixture-token',
    'BotHub <sender@example.test>',
  );
  await mail.send({ to: 'recipient@example.test', subject: 'Hello', text: 'Fixture' });
  const payload = JSON.parse(fetch.mock.calls[0]?.[1].body);
  expect(payload.to).toEqual(['recipient@example.test']);
  await expect(
    mail.send({ to: 'recipient@example.test', subject: 'Hello', text: 'Fixture' }),
  ).rejects.toThrow('Email delivery failed');
});
it('structured logging redacts authentication and nested credentials', () => {
  let output = '';
  const logger = createLogger({
    write(chunk: string) {
      output += chunk;
    },
  });
  logger.info(
    {
      password: 'fixture-password',
      token: 'fixture-token',
      credentials: { channel: 'fixture-value' },
      user: { email: 'private@example.test' },
      req: { headers: { authorization: 'fixture-bearer', cookie: 'fixture-session' } },
    },
    'Safe event',
  );
  expect(output).not.toMatch(/fixture-|private@example/);
  expect(JSON.parse(output).msg).toBe('Safe event');
  expect(output).toContain('[REDACTED]');
});
