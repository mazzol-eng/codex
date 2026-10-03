import { test, expect } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
import { db } from '../../packages/db/src/index';
import { sealCredentials } from '../../packages/runtime/src/credentials';
const origin = { Origin: 'http://localhost:3000' },
  emails: string[] = [];
test.afterAll(async () => {
  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  await db.workspace.deleteMany({
    where: { members: { some: { userId: { in: users.map((u) => u.id) } } } },
  });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await db.$disconnect();
});
async function account(page: import('@playwright/test').Page) {
  const email = `phase3-${Date.now()}-${randomUUID()}@e2e.bothub.local`;
  emails.push(email);
  expect(
    (
      await page.request.post('/api/auth/sign-up/email', {
        headers: origin,
        data: { name: 'Marina Campanhas', email, password: 'Local-E2E-Password-2026!' },
      })
    ).ok(),
  ).toBe(true);
  const r = await page.request.post('/api/workspaces', {
    headers: origin,
    data: { name: 'Empresa das campanhas', segment: 'Serviços', timeZone: 'America/Sao_Paulo' },
  });
  expect(r.ok()).toBe(true);
  const workspaceId = (await r.json()).id;
  const b = await page.request.post(`/api/bots?workspaceId=${workspaceId}`, {
    headers: origin,
    data: { name: 'Assistente', templateId: 'faq' },
  });
  expect(b.ok()).toBe(true);
  return { workspaceId, botId: (await b.json()).id };
}
test('CRM import, provenance, SMS review, worker delivery and CSV report', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { workspaceId } = await account(page);
  await page.goto('/app/channels');
  await page.getByRole('button', { name: 'Conectar SMS', exact: true }).click();
  await page.getByLabel('Nome da conexão').fill('SMS de teste');
  await page.getByRole('button', { name: 'Conectar canal', exact: true }).click();
  await expect(page.locator('.connection-row').filter({ hasText: 'SMS de teste' })).toContainText(
    'Demonstração',
  );
  await page.goto('/app/contacts');
  await page.getByRole('button', { name: 'Novo contato', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Camila Costa');
  await page.getByLabel('Telefone ou identificador do canal').fill('+5511999998888');
  await page.getByLabel('Tags, separadas por vírgula').fill('cliente');
  await page.getByLabel('Autorizou conversas neste canal').check();
  await page.getByLabel('Autorizou receber campanhas').check();
  await page.getByLabel('Origem da autorização').fill('Formulário de teste autorizado');
  await page.getByRole('button', { name: 'Salvar contato', exact: true }).click();
  await expect(page.locator('.crm-table')).toContainText('Camila Costa');
  await expect(page.locator('.crm-table')).toContainText('Autorizado');
  await page.getByRole('button', { name: 'Importar CSV', exact: true }).click();
  await page.getByLabel('Arquivo CSV').setInputFiles({
    name: 'contatos.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'nome,telefone,email,tags\nRafael Silva,+5511999998889,rafael@example.com,cliente\nJuliana Lima,+5511999998890,juliana@example.com,cliente',
    ),
  });
  await expect(page.getByText(/2 contatos no arquivo/)).toBeVisible();
  await page.getByLabel('Autorizou conversas neste canal').check();
  await page
    .getByLabel('Origem da autorização')
    .fill('Autorização fictícia para conversas, sem marketing');
  await page.getByRole('button', { name: 'Importar 2 contatos', exact: true }).click();
  await expect(page.locator('.crm-table tbody tr')).toHaveCount(3);
  await page.getByRole('button', { name: 'Salvar segmento', exact: true }).click();
  await page.getByLabel('Nome do segmento').fill('Meu público');
  await page.getByRole('button', { name: 'Salvar segmento', exact: true }).last().click();
  await expect(page.locator('.crm-segments')).toContainText('Meu público');
  await page.goto('/app/campaigns');
  await page.getByRole('button', { name: 'Nova campanha', exact: true }).click();
  await page.getByLabel('Nome da campanha').fill('Novidades para clientes');
  await page
    .getByLabel('Mensagem', { exact: true })
    .fill('Olá, {{contact.first_name}}! Conheça nossas novidades.');
  await page.getByRole('button', { name: 'Revisar campanha', exact: true }).click();
  await expect(page.locator('.campaign-review-stats')).toContainText('1');
  await expect(page.locator('.campaign-review-stats')).toContainText('2');
  await expect(page.getByText('Custo estimado: R$ 0,20')).toBeVisible();
  await expect(page.locator('.campaign-chat-preview')).toContainText('Olá, Camila!');
  await page
    .getByRole('button', { name: 'Confirmar envio para 1 contato(s)', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Novidades para clientes');
  await expect(page.locator('.campaign-recipient-list')).toContainText('Enviada', {
    timeout: 20000,
  });
  await expect(page.locator('.campaign-recipient-list')).toContainText('Sem autorização');
  const c = await db.campaign.findFirstOrThrow({
    where: { workspaceId, name: 'Novidades para clientes' },
  });
  const csv = await page.request.get(`/api/campaigns/${c.id}/export?workspaceId=${workspaceId}`);
  expect(csv.headers()['content-type']).toContain('text/csv');
  expect(await csv.text()).toContain('Camila Costa');
  expect(await db.message.count({ where: { workspaceId, campaignId: c.id, status: 'sent' } })).toBe(
    1,
  );
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/contacts');
  await expect(page.getByRole('heading', { name: 'Conheça seu público' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/app/campaigns');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('WhatsApp existing account demo, template creation and approved campaign', async ({
  page,
}) => {
  test.setTimeout(90000);
  const { workspaceId, botId } = await account(page);
  await page.goto('/app/channels');
  await page.getByRole('button', { name: 'Conectar WhatsApp', exact: true }).click();
  await page.getByLabel('Nome da conexão').fill('WhatsApp de teste');
  await page.getByRole('button', { name: 'Conectar canal', exact: true }).click();
  await expect(page.locator('.connection-row')).toContainText('Demonstração');
  const conn = await db.connection.findFirstOrThrow({
    where: { workspaceId, channel: 'whatsapp' },
  });
  const contact = await page.request.post(`/api/contacts?workspaceId=${workspaceId}`, {
    headers: origin,
    data: {
      name: 'Ana WhatsApp',
      connectionId: conn.id,
      externalContactId: '5511998882222',
      consent: true,
      marketingConsent: true,
      source: 'Formulário de teste',
    },
  });
  expect(contact.status()).toBe(201);
  await page.getByRole('link', { name: 'Templates do WhatsApp' }).click();
  await page.getByRole('button', { name: 'Novo template', exact: true }).click();
  await page.getByLabel('Nome do template').fill('novidades_teste');
  await page.getByRole('button', { name: 'Criar na demonstração', exact: true }).click();
  await expect(page.locator('.wa-template-card')).toContainText('Aprovado');
  await expect(page.locator('.wa-template-card')).toContainText('Aprovação simulada');
  await page.goto('/app/campaigns');
  await page.getByRole('button', { name: 'Nova campanha', exact: true }).click();
  await page.getByLabel('Nome da campanha').fill('Novidades WhatsApp');
  await page.getByLabel('Template aprovado').selectOption({ label: 'novidades_teste · pt_BR' });
  await page.getByLabel('Valor da variável 1').fill('{{contact.first_name}}');
  await page.getByRole('button', { name: 'Revisar campanha', exact: true }).click();
  await expect(page.locator('.campaign-chat-preview')).toContainText('Olá, Ana!');
  await page
    .getByRole('button', { name: 'Confirmar envio para 1 contato(s)', exact: true })
    .click();
  await expect(page.locator('.campaign-recipient-list')).toContainText('Enviada', {
    timeout: 20000,
  });
  expect(await db.bot.count({ where: { workspaceId, id: botId } })).toBe(1);
  expect(conn.mode).toBe('fake');
});
test('Meta challenge, signed ingress, dedupe and rejection before persistence', async ({
  page,
}) => {
  const { workspaceId, botId } = await account(page),
    phone = '8' + Date.now(),
    verify = randomUUID(),
    secret = randomUUID();
  const connection = await db.connection.create({
    data: {
      workspaceId,
      botId,
      name: 'Signed fixture',
      channel: 'whatsapp',
      status: 'pending',
      mode: 'real',
      externalAccountId: phone,
      verificationHash: createHmac('sha256', '').update('unused').digest('hex'),
      credentialCiphertext: sealCredentials({
        phoneNumberId: phone,
        wabaId: '123456789012',
        accessToken: 'fixture-only-not-real',
        verifyToken: verify,
        appSecret: secret,
      }),
    },
  });
  const { createHash } = await import('node:crypto');
  await db.connection.updateMany({
    where: { workspaceId, id: connection.id },
    data: { verificationHash: createHash('sha256').update(verify).digest('hex') },
  });
  expect(
    (
      await page.request.get(
        `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=1234`,
      )
    ).status(),
  ).toBe(403);
  const challenge = await page.request.get(
    `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${verify}&hub.challenge=1234`,
  );
  expect(challenge.status()).toBe(200);
  expect(await challenge.text()).toBe('1234');
  const payload = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '123456789012',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: phone },
              messages: [
                {
                  id: 'wamid.fixture-' + randomUUID(),
                  from: '5511998761111',
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: 'Olá' },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const invalid = await page.request.post('/api/webhooks/whatsapp', {
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': 'sha256=' + '0'.repeat(64),
    },
    data: payload,
  });
  expect(invalid.status()).toBe(401);
  expect(await db.webhookEvent.count({ where: { workspaceId } })).toBe(0);
  const headers = {
    'Content-Type': 'application/json',
    'X-Hub-Signature-256': 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex'),
  };
  for (let i = 0; i < 2; i++)
    expect(
      (await page.request.post('/api/webhooks/whatsapp', { headers, data: payload })).status(),
    ).toBe(200);
  expect(await db.webhookEvent.count({ where: { workspaceId, connectionId: connection.id } })).toBe(
    1,
  );
  const csrf = await page.request.post(`/api/campaigns/preview?workspaceId=${workspaceId}`, {
    headers: { Origin: 'https://invalid.example' },
    data: {},
  });
  expect(csrf.status()).toBe(403);
});
