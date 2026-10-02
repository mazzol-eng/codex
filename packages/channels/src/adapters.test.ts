import { it, expect } from 'vitest';
import { TelegramAdapter, FakeTelegramTransport, SimulatorAdapter } from './adapters';
import { degradeMessage } from './index';
const adapter = new TelegramAdapter(
  { token: 'fixture-token', secretToken: 'fixture-secret' },
  new FakeTelegramTransport(),
);
it('verifies Telegram secret header with constant-time comparison', () => {
  expect(adapter.verifyWebhook('', { 'x-telegram-bot-api-secret-token': 'fixture-secret' })).toBe(
    true,
  );
  expect(adapter.verifyWebhook('', { 'x-telegram-bot-api-secret-token': 'bad' })).toBe(false);
});
it('normalizes Telegram text/commands, callback, media and location fixtures', () => {
  const base = { message_id: 9, date: 1790856000, chat: { id: 22, first_name: 'Ana' } };
  for (const [input, type] of [
    [{ update_id: 1, message: { ...base, text: '/start' } }, 'text'],
    [
      {
        update_id: 2,
        callback_query: { id: 'cb', from: { id: 22 }, message: base, data: 'c:hours' },
      },
      'button_reply',
    ],
    [{ update_id: 3, message: { ...base, photo: [{ file_id: 'abc' }] } }, 'media'],
    [
      { update_id: 4, message: { ...base, location: { latitude: -23, longitude: -46 } } },
      'location',
    ],
  ] as const) {
    expect(adapter.normalize(input, 'connection')[0]).toMatchObject({
      type,
      externalContactId: '22',
      connectionId: 'connection',
    });
  }
  expect(adapter.normalize({}, 'c')).toEqual([]);
});
it('uses getMe, secret_token webhook, short inline IDs and media methods', async () => {
  const transport = new FakeTelegramTransport(),
    a = new TelegramAdapter({ token: 'fake', secretToken: 'secret' }, transport);
  expect(await a.validateCredentials({ token: 'fake' })).toBe(true);
  await a.registerWebhook('https://example.com/webhook');
  await a.send('2', {
    type: 'buttons',
    text: 'Menu',
    choices: [{ id: 'hours', label: 'Horários' }],
  });
  await a.send('2', {
    type: 'media',
    text: 'Imagem',
    mediaUrl: 'https://example.com/a.png',
    mediaType: 'image',
  });
  expect(transport.calls.map((c) => c.method)).toEqual([
    'getMe',
    'setWebhook',
    'sendMessage',
    'sendPhoto',
  ]);
  expect(transport.calls[1]!.body.secret_token).toBe('secret');
  expect(JSON.stringify(transport.calls[2]!.body)).toContain('c:hours');
});
it('degrades generic buttons for SMS and WhatsApp capabilities', () => {
  const m = {
    type: 'buttons' as const,
    text: 'Escolha',
    choices: Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, label: `Opção ${i + 1}` })),
  };
  expect(degradeMessage('sms', m)).toMatchObject({
    type: 'text',
    text: expect.stringContaining('Responda 1, 2, 3, 4, 5'),
  });
  expect(degradeMessage('whatsapp', m).type).toBe('list');
  expect(degradeMessage('telegram', m)).toEqual(m);
});
it('simulator implements the same send/normalize contract without credentials', async () => {
  const a = new SimulatorAdapter();
  const e = a.normalize({ text: 'oi', contactId: 'x', id: 'm' }, 'c');
  expect(e[0]?.channel).toBe('simulator');
  expect((await a.send('x', { type: 'text', text: 'Olá' })).status).toBe('sent');
  expect(a.sent).toHaveLength(1);
});
