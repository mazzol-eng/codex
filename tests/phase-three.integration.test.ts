import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { db, createWorkspace, AccessDenied } from '../packages/db/src/index';
import {
  createBot,
  createConnection,
  createContact,
  updateContact,
  listContacts,
  importContacts,
  saveSegment,
  listSegments,
  previewCampaign,
  createCampaign,
  activateCampaign,
  dispatchCampaign,
  getCampaign,
  cancelCampaign,
  createWhatsAppTemplate,
  syncWhatsAppTemplates,
  ingestStatus,
  processEvent,
  sendPending,
  openCredentials,
  deleteContact,
  ingest,
} from '../packages/runtime/src/index';
import { FakeSmsProvider, FakeWhatsAppTransport } from '../packages/channels/src/adapters';
import { workspaceDateToUtc } from '../config/dates';
const run = randomUUID(),
  user = 'phase3-' + run,
  other = 'phase3-other-' + run,
  viewer = 'phase3-viewer-' + run;
let ws: string,
  otherWs: string,
  bot: string,
  sms: string,
  wa: string,
  yes: string,
  no: string,
  out: string;
beforeAll(async () => {
  await db.user.createMany({
    data: [user, other, viewer].map((id) => ({
      id,
      name: 'Phase Three',
      email: id + '@test.local',
    })),
  });
  ws = (
    await createWorkspace(user, {
      name: 'Phase Three',
      segment: 'Serviços',
      timeZone: 'America/Sao_Paulo',
    })
  ).id;
  otherWs = (
    await createWorkspace(other, {
      name: 'Other',
      segment: 'Serviços',
      timeZone: 'America/Sao_Paulo',
    })
  ).id;
  await db.membership.create({ data: { workspaceId: ws, userId: viewer, role: 'viewer' } });
  bot = (await createBot(user, ws, { name: 'Atendimento', templateId: 'faq' })).id;
  sms = (
    await createConnection(user, ws, {
      name: 'SMS fake',
      botId: bot,
      channel: 'sms',
      mode: 'fake',
      smsPriceCents: 10,
    })
  ).id;
  wa = (
    await createConnection(user, ws, {
      name: 'WhatsApp fake',
      botId: bot,
      channel: 'whatsapp',
      mode: 'fake',
    })
  ).id;
  yes = (
    await createContact(user, ws, {
      name: 'Ana Silva',
      connectionId: sms,
      externalContactId: '+5511999991001',
      tags: ['all', 'allowed'],
      consent: true,
      marketingConsent: true,
      source: 'fixture form',
    })
  ).id;
  no = (
    await createContact(user, ws, {
      name: 'Bruno Silva',
      connectionId: sms,
      externalContactId: '+5511999991002',
      tags: ['all'],
      consent: true,
      source: 'fixture chat',
    })
  ).id;
  out = (
    await createContact(user, ws, {
      name: 'Carla Silva',
      connectionId: sms,
      externalContactId: '+5511999991003',
      tags: ['all'],
    })
  ).id;
}, 15000);
afterAll(async () => {
  await db.workspace.deleteMany({ where: { id: { in: [ws, otherWs].filter(Boolean) } } });
  await db.user.deleteMany({ where: { id: { in: [user, other, viewer] } } });
  await db.$disconnect();
});
const campaignInput = (tag = 'all') => ({
  name: 'Campanha de teste',
  connectionId: sms,
  filters: { tag },
  message: { type: 'text' as const, text: 'Olá, {{contact.first_name}}!' },
});
async function queueCampaign(tag = 'allowed') {
  const input = campaignInput(tag),
    preview = await previewCampaign(user, ws, input),
    c = await createCampaign(user, ws, input);
  await activateCampaign(user, ws, c.id, preview.digest);
  await dispatchCampaign(ws, c.id, Date.now() + 10);
  return c;
}
it('scopes CRM, segments, templates and campaigns to membership and compound tenant keys', async () => {
  await expect(listContacts(other, ws)).rejects.toBeInstanceOf(AccessDenied);
  await expect(
    createContact(viewer, ws, { name: 'No permission', connectionId: sms, externalContactId: 'x' }),
  ).rejects.toBeInstanceOf(AccessDenied);
  await expect(
    createContact(other, otherWs, {
      name: 'Wrong channel',
      connectionId: sms,
      externalContactId: 'x',
    }),
  ).rejects.toThrow();
  await expect(
    db.segment
      .create({ data: { workspaceId: otherWs, name: 'Wrong', filters: {} } })
      .then(async (segment) =>
        db.campaign.create({
          data: {
            workspaceId: otherWs,
            connectionId: sms,
            name: segment.name,
            content: {},
            filters: {},
          },
        }),
      ),
  ).rejects.toThrow();
  await saveSegment(user, ws, 'Authorized', { tag: 'allowed', marketingConsent: true });
  expect((await listSegments(user, ws))[0]?.count).toBe(1);
  expect(
    (await listSegments(other, otherWs)).every(
      (segment) => segment.workspaceId === otherWs && segment.name !== 'Authorized',
    ),
  ).toBe(true);
});
it('encrypts both provider credentials and never returns secrets in connection results', async () => {
  for (const id of [sms, wa]) {
    const c = await db.connection.findFirstOrThrow({ where: { workspaceId: ws, id } });
    expect(c.credentialCiphertext).not.toContain('fake-');
    expect(openCredentials(c.credentialCiphertext!)).toBeTruthy();
  }
  const result = await createConnection(
    user,
    ws,
    {
      name: 'Service without number',
      botId: bot,
      channel: 'sms',
      credentials: {
        accountSid: 'AC' + '1'.repeat(32),
        authToken: 'fixture-secret-123456',
        messagingServiceSid: 'MG' + '1'.repeat(32),
      },
    },
    { sms: new FakeSmsProvider() },
  );
  expect(result).not.toHaveProperty('credentialCiphertext');
  expect(result.externalAccountId).toBe('MG' + '1'.repeat(32));
});
it('imports atomically, maps CSV columns and preserves previous opt-outs', async () => {
  const result = await importContacts(user, ws, {
    connectionId: sms,
    csv: 'nome,telefone,tags\nCarla Atualizada,+5511999991003,cliente\nDavi Importado,+5511999991004,cliente',
    mapping: { name: 'nome', externalContactId: 'telefone', tags: 'tags' },
    consent: true,
    marketingConsent: true,
    source: 'fixture checkbox',
  });
  expect(result).toEqual({ created: 1, updated: 1, rows: 2 });
  expect(
    (await db.contact.findFirstOrThrow({ where: { workspaceId: ws, id: out } })).marketingConsent,
  ).toBe(false);
  await expect(
    importContacts(user, ws, {
      connectionId: sms,
      csv: 'nome,telefone\nValid,+5511999991005\nBroken,123',
      mapping: { name: 'nome', externalContactId: 'telefone' },
    }),
  ).rejects.toThrow(/Linha 3/);
  expect(
    await db.contact.count({ where: { workspaceId: ws, externalContactId: '+5511999991005' } }),
  ).toBe(0);
});
it('requires explicit provenance and rejects unsafe custom field names', async () => {
  await expect(
    createContact(user, ws, {
      name: 'Unsafe',
      connectionId: sms,
      externalContactId: '+5511999999001',
      consent: true,
    }),
  ).rejects.toThrow();
  await expect(
    updateContact(user, ws, out, { marketingConsent: true, source: 'no conversation consent' }),
  ).rejects.toThrow();
  await expect(
    updateContact(user, ws, no, { fields: { constructor: 'unsafe' } }),
  ).rejects.toThrow();
});
it('previews only opt-ins, renders safe variables and estimates exact SMS segments', async () => {
  const p = await previewCampaign(user, ws, campaignInput());
  expect(p).toMatchObject({
    total: 3,
    eligible: 1,
    blocked: 2,
    segments: 1,
    estimatedCostCents: 10,
    mode: 'fake',
  });
  expect(p.samples[0]?.message?.text).toContain('Olá, Ana!');
  expect(p.samples[0]?.message?.text).toContain('PARAR');
});
it('rejects a stale audience review before scheduling', async () => {
  const input = campaignInput('allowed'),
    p = await previewCampaign(user, ws, input),
    c = await createCampaign(user, ws, input);
  await updateContact(user, ws, yes, { name: 'Julia Atualizada' });
  await expect(activateCampaign(user, ws, c.id, p.digest)).rejects.toThrow(/mudou/);
  expect((await getCampaign(user, ws, c.id)).status).toBe('draft');
});
it('schedules in the workspace zone and does not queue early', async () => {
  expect(workspaceDateToUtc('2026-10-04T09:00', 'America/Sao_Paulo')).toBe(
    '2026-10-04T12:00:00.000Z',
  );
  expect(() => workspaceDateToUtc('2026-03-08T02:30', 'America/New_York')).toThrow();
  const input = campaignInput('allowed'),
    p = await previewCampaign(user, ws, input),
    c = await createCampaign(user, ws, input),
    future = Date.now() + 3600000;
  await activateCampaign(user, ws, c.id, p.digest, new Date(future).toISOString());
  await dispatchCampaign(ws, c.id, future - 1000);
  expect(await db.message.count({ where: { workspaceId: ws, campaignId: c.id } })).toBe(0);
  await cancelCampaign(user, ws, c.id);
});
it('dispatches idempotently and completes after delivery without contacting Twilio', async () => {
  const c = await queueCampaign();
  await dispatchCampaign(ws, c.id);
  const m = await db.message.findFirstOrThrow({ where: { workspaceId: ws, campaignId: c.id } });
  expect(await db.message.count({ where: { workspaceId: ws, campaignId: c.id } })).toBe(1);
  const provider = new FakeSmsProvider();
  await sendPending(m.id, ws, { sms: provider });
  expect(provider.calls).toHaveLength(1);
  await dispatchCampaign(ws, c.id);
  expect(await getCampaign(user, ws, c.id)).toMatchObject({
    status: 'completed',
    stats: { sent: 1, pending: 0 },
  });
});
it('rechecks consent after a message enters the outbox', async () => {
  const c = await queueCampaign();
  const m = await db.message.findFirstOrThrow({ where: { workspaceId: ws, campaignId: c.id } });
  await updateContact(user, ws, yes, { consent: false });
  const provider = new FakeSmsProvider();
  await sendPending(m.id, ws, { sms: provider }, Date.now() + 10000);
  expect(provider.calls).toHaveLength(0);
  expect(
    (await db.message.findFirstOrThrow({ where: { workspaceId: ws, id: m.id } })).lastError,
  ).toBe('contact_opted_out');
  await updateContact(user, ws, yes, {
    consent: true,
    marketingConsent: true,
    source: 'fixture reauthorization',
  });
});
it('cancels queued recipients before the provider receives a request', async () => {
  const c = await queueCampaign();
  const m = await db.message.findFirstOrThrow({ where: { workspaceId: ws, campaignId: c.id } });
  await cancelCampaign(user, ws, c.id);
  const provider = new FakeSmsProvider();
  await sendPending(m.id, ws, { sms: provider }, Date.now() + 10000);
  expect(provider.calls).toHaveLength(0);
  expect((await getCampaign(user, ws, c.id)).status).toBe('cancelled');
});
it('blocks unapproved WhatsApp templates and allows approved templates outside 24h', async () => {
  const t = await createWhatsAppTemplate(user, ws, {
    connectionId: wa,
    name: 'fixture_marketing',
    language: 'pt_BR',
    category: 'MARKETING',
    body: 'Olá, {{1}}! Responda PARAR.',
    examples: ['Ana'],
  });
  expect(t.status).toBe('APPROVED');
  await createContact(user, ws, {
    name: 'Ana WhatsApp',
    connectionId: wa,
    externalContactId: '5511999993001',
    tags: ['wa'],
    consent: true,
    marketingConsent: true,
    source: 'fixture consent',
  });
  const input = {
      ...campaignInput('wa'),
      connectionId: wa,
      templateId: t.id,
      parameters: ['{{contact.first_name}}'],
    },
    p = await previewCampaign(user, ws, input),
    c = await createCampaign(user, ws, input);
  await activateCampaign(user, ws, c.id, p.digest);
  await dispatchCampaign(ws, c.id);
  const m = await db.message.findFirstOrThrow({ where: { workspaceId: ws, campaignId: c.id } }),
    provider = new FakeWhatsAppTransport();
  await sendPending(m.id, ws, { whatsapp: provider });
  expect(provider.calls).toHaveLength(1);
  await db.whatsAppTemplate.updateMany({
    where: { workspaceId: ws, id: t.id },
    data: { status: 'PENDING' },
  });
  await expect(previewCampaign(user, ws, input)).rejects.toThrow(/aprovado/);
  const convo = await db.conversation.findFirstOrThrow({
    where: { workspaceId: ws, connectionId: wa },
  });
  const normal = await db.message.create({
    data: {
      workspaceId: ws,
      conversationId: convo.id,
      direction: 'outbound',
      status: 'pending',
      content: { type: 'text', text: 'Free form blocked' },
    },
  });
  await sendPending(normal.id, ws, { whatsapp: provider }, Date.now() + 10000);
  expect(
    (await db.message.findFirstOrThrow({ where: { workspaceId: ws, id: normal.id } })).lastError,
  ).toBe('whatsapp_window_expired');
  expect(provider.calls).toHaveLength(1);
});
it('synchronizes official approval and marks unsupported template formats', async () => {
  const p = new FakeWhatsAppTransport();
  p.templates = [
    {
      id: 'meta123',
      name: 'otp_code',
      language: 'pt_BR',
      category: 'AUTHENTICATION',
      status: 'APPROVED',
      components: [{ type: 'BODY', text: 'Code {{1}}' }],
    },
  ];
  expect((await syncWhatsAppTemplates(user, ws, wa, { whatsapp: p })).synced).toBe(1);
  expect(
    (await db.whatsAppTemplate.findFirstOrThrow({ where: { workspaceId: ws, name: 'otp_code' } }))
      .supported,
  ).toBe(false);
});
it('deduplicates status receipts and never regresses read to delivered', async () => {
  const m = await db.message.findFirstOrThrow({
      where: { workspaceId: ws, externalId: { not: null }, conversation: { connectionId: sms } },
    }),
    conn = { id: sms, workspaceId: ws };
  const receipt = {
    externalMessageId: m.externalId!,
    status: 'read' as const,
    timestamp: new Date().toISOString(),
  };
  const a = await ingestStatus(conn, receipt),
    b = await ingestStatus(conn, { ...receipt, timestamp: new Date(Date.now() + 1).toISOString() });
  expect(a.id).toBe(b.id);
  await processEvent(ws, a.id);
  const e = await ingestStatus(conn, { ...receipt, status: 'delivered' });
  await processEvent(ws, e.id);
  expect((await db.message.findFirstOrThrow({ where: { workspaceId: ws, id: m.id } })).status).toBe(
    'read',
  );
});
it('inbound opt-out revokes campaign consent even with a paused bot', async () => {
  const e = await ingest(
    { id: sms, workspaceId: ws },
    {
      channel: 'sms',
      connectionId: sms,
      externalContactId: '+5511999991001',
      externalMessageId: randomUUID(),
      text: 'PARAR',
      type: 'text',
      timestamp: new Date().toISOString(),
    },
  );
  await processEvent(ws, e.id);
  const c = await db.contact.findFirstOrThrow({ where: { workspaceId: ws, id: yes } });
  expect(c).toMatchObject({ consent: false, marketingConsent: false });
  expect(
    await db.consentRecord.count({
      where: { workspaceId: ws, contactId: yes, scope: 'all', granted: false },
    }),
  ).toBe(1);
});
it('deletes a contact together with messages and campaign recipient references', async () => {
  await deleteContact(user, ws, yes);
  expect(await db.campaignRecipient.count({ where: { workspaceId: ws, contactId: yes } })).toBe(0);
  expect(await db.contact.count({ where: { workspaceId: ws, id: yes } })).toBe(0);
});
