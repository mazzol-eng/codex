import { it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { WhatsAppAdapter, FakeWhatsAppTransport, SmsAdapter, FakeSmsProvider } from './adapters';
import { measureSms } from './index';
const credentials = {
  phoneNumberId: '123456789012',
  wabaId: '999999999999',
  accessToken: 'fixture-access-token',
  appSecret: 'fixture-app-secret',
  verifyToken: 'fixture-verify-token',
};
const payload = {
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: credentials.phoneNumberId },
            contacts: [{ wa_id: '5511999999999', profile: { name: 'Ana Silva' } }],
            messages: [
              {
                id: 'wamid.fixture-text',
                from: '5511999999999',
                timestamp: '1790985600',
                type: 'text',
                text: { body: 'Olá' },
              },
              {
                id: 'wamid.fixture-reply',
                from: '5511999999999',
                timestamp: '1790985600',
                type: 'interactive',
                interactive: {
                  type: 'button_reply',
                  button_reply: { id: 'hours', title: 'Horários' },
                },
              },
              {
                id: 'wamid.fixture-photo',
                from: '5511999999999',
                timestamp: '1790985600',
                type: 'image',
                image: { id: 'media-1', caption: 'Meu pedido' },
              },
            ],
            statuses: [{ id: 'wamid.sent', status: 'delivered', timestamp: '1790985601' }],
          },
        },
      ],
    },
  ],
};
it('normalizes WhatsApp text, buttons, media and delivery receipts from the existing number', () => {
  const adapter = new WhatsAppAdapter(credentials, new FakeWhatsAppTransport());
  expect(adapter.normalize(payload, 'c')).toMatchObject([
    { channel: 'whatsapp', contactName: 'Ana Silva', text: 'Olá' },
    { type: 'button_reply', payload: 'hours' },
    { type: 'media', payload: { fileId: 'media-1' } },
  ]);
  expect(adapter.normalizeStatuses(payload)).toMatchObject([
    { externalMessageId: 'wamid.sent', status: 'delivered' },
  ]);
  expect(
    new WhatsAppAdapter({ ...credentials, phoneNumberId: 'other' }).normalize(payload, 'c'),
  ).toEqual([]);
});
it('rejects modified Meta payloads, invalid signatures and verification tokens', () => {
  const adapter = new WhatsAppAdapter(credentials);
  const body = JSON.stringify(payload),
    signature = `sha256=${createHmac('sha256', credentials.appSecret).update(body).digest('hex')}`;
  expect(adapter.verifyWebhook(body, { 'x-hub-signature-256': signature })).toBe(true);
  expect(adapter.verifyWebhook(body + ' ', { 'x-hub-signature-256': signature })).toBe(false);
  expect(adapter.verifyWebhook(body, { 'x-hub-signature-256': 'sha256=bad' })).toBe(false);
  expect(adapter.verifyChallenge(credentials.verifyToken)).toBe(true);
  expect(adapter.verifyChallenge('wrong')).toBe(false);
});
it('sends WhatsApp buttons, degrades four choices to a list and sends approved template parameters', async () => {
  const transport = new FakeWhatsAppTransport(),
    adapter = new WhatsAppAdapter(credentials, transport);
  const choices = Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, label: `Opção ${i + 1}` }));
  await adapter.send('5511999999999', {
    type: 'buttons',
    text: 'Escolha',
    choices: choices.slice(0, 3),
  });
  expect(transport.calls.at(-1)?.body).toMatchObject({
    type: 'interactive',
    interactive: { type: 'button', action: { buttons: expect.any(Array) } },
  });
  await adapter.send('5511999999999', { type: 'buttons', text: 'Escolha', choices });
  expect(transport.calls.at(-1)?.body).toMatchObject({ interactive: { type: 'list' } });
  await adapter.send('5511999999999', {
    type: 'text',
    text: 'Olá, Ana',
    templateName: 'welcome',
    templateLanguage: 'pt_BR',
    templateParameters: ['Ana'],
  });
  expect(transport.calls.at(-1)?.body).toMatchObject({
    type: 'template',
    template: {
      name: 'welcome',
      components: [{ type: 'body', parameters: [{ type: 'text', text: 'Ana' }] }],
    },
  });
});
const smsCredentials = {
  accountSid: `AC${'0'.repeat(32)}`,
  authToken: 'fixture-sms-token',
  from: '+5511999990000',
};
it('verifies Twilio URLs and parameters, maps inbound SMS and interprets statuses', () => {
  const provider = new FakeSmsProvider(),
    adapter = new SmsAdapter(smsCredentials, provider);
  const url = 'https://bothub.example/api/webhooks/sms/conn';
  const raw = new URLSearchParams({
    AccountSid: smsCredentials.accountSid,
    MessageSid: `SM${'1'.repeat(32)}`,
    From: '+5511988880000',
    Body: 'Olá + pedido',
  }).toString();
  const data =
    url +
    'AccountSid' +
    smsCredentials.accountSid +
    'BodyOlá + pedidoFrom+5511988880000MessageSid' +
    `SM${'1'.repeat(32)}`;
  const signature = createHmac('sha1', smsCredentials.authToken).update(data).digest('base64');
  const headers = { 'x-bothub-webhook-url': url, 'x-twilio-signature': signature };
  expect(adapter.verifyWebhook(raw, headers)).toBe(true);
  expect(adapter.verifyWebhook(raw + '&Body=modified', headers)).toBe(false);
  expect(adapter.verifyWebhook(raw, { ...headers, 'x-bothub-webhook-url': url + '/status' })).toBe(
    false,
  );
  expect(adapter.normalize(Object.fromEntries(new URLSearchParams(raw)), 'c')).toMatchObject([
    { channel: 'sms', text: 'Olá + pedido', externalContactId: '+5511988880000' },
  ]);
  expect(
    adapter.normalizeStatuses({
      AccountSid: smsCredentials.accountSid,
      MessageSid: 'sid',
      MessageStatus: 'undelivered',
    }),
  ).toMatchObject([{ status: 'failed' }]);
});
it('degrades SMS buttons to a numbered text and media to a link', async () => {
  const provider = new FakeSmsProvider(),
    adapter = new SmsAdapter(smsCredentials, provider);
  await adapter.send('+5511988880000', {
    type: 'buttons',
    text: 'Escolha',
    choices: [
      { id: 'a', label: 'Horários' },
      { id: 'b', label: 'Equipe' },
    ],
  });
  expect(provider.calls[0]?.text).toContain('1. Horários\n2. Equipe\nResponda 1, 2.');
  await adapter.send('+5511988880000', {
    type: 'media',
    text: 'Veja',
    mediaUrl: 'https://example.com/image.png',
  });
  expect(provider.calls[1]?.text).toContain('https://example.com/image.png');
});
it('counts GSM escape characters, UCS-2 emoji and multipart SMS accurately', () => {
  expect(measureSms('a'.repeat(160))).toMatchObject({ encoding: 'GSM-7', segments: 1, units: 160 });
  expect(measureSms('a'.repeat(161)).segments).toBe(2);
  expect(measureSms('€'.repeat(81))).toMatchObject({ encoding: 'GSM-7', units: 162, segments: 2 });
  expect(measureSms('😊'.repeat(35))).toMatchObject({
    encoding: 'UCS-2',
    characters: 35,
    units: 70,
    segments: 1,
  });
  expect(measureSms('😊'.repeat(36)).segments).toBe(2);
  expect(measureSms('').segments).toBe(0);
});
