import { test, expect } from '@playwright/test';
import { db } from '../../packages/db/src/index';
const origin = { Origin: 'http://localhost:3000' };
const emails: string[] = [];
test.afterAll(async () => {
  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  await db.workspace.deleteMany({
    where: { members: { some: { userId: { in: users.map((u) => u.id) } } } },
  });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await db.$disconnect();
});
test('template, editor autosave, publication, simulator, channel and live human Inbox', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const email = `phase2-${Date.now()}@e2e.bothub.local`;
  emails.push(email);
  expect(
    (
      await page.request.post('/api/auth/sign-up/email', {
        headers: origin,
        data: { name: 'Ana Automação', email, password: 'Local-E2E-Password-2026!' },
      })
    ).ok(),
  ).toBe(true);
  const ws = await page.request.post('/api/workspaces', {
    headers: origin,
    data: { name: 'Empresa de Conversas', segment: 'Serviços', timeZone: 'America/Sao_Paulo' },
  });
  expect(ws.ok()).toBe(true);
  const workspaceId = (await ws.json()).id;
  await page.goto('/app/templates');
  await page
    .locator('.template-card')
    .filter({ hasText: 'Atendimento e FAQ' })
    .getByRole('button', { name: 'Usar template', exact: true })
    .click();
  await page.getByLabel('Nome do bot').fill('Assistente de testes');
  await page.getByRole('button', { name: 'Usar template e abrir editor' }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.locator('.flow-node')).toHaveCount(5);
  await expect(page.getByLabel('Texto da mensagem')).toBeVisible();
  await page.getByLabel('Texto da mensagem').fill('Olá! Escolha uma opção para começar.');
  await expect(page.getByText('Rascunho salvo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByText('v1 publicada', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Testar', exact: true }).click();
  await page.getByRole('button', { name: 'Começar teste', exact: true }).click();
  await expect(page.locator('.simulator-bubble.outbound').first()).toContainText(
    'Escolha uma opção',
  );
  await page.getByRole('button', { name: 'Horário de atendimento', exact: true }).click();
  await expect(page.locator('.simulator-bubble.outbound').last()).toContainText('segunda a sexta');
  await expect(page.locator('.simulator-variables')).toContainText('hours');
  await expect(page.locator('.flow-node.traversed')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/phase-two-editor-desktop.png', fullPage: true });
  const botId = page.url().split('/').at(-2)!;
  await page.getByRole('button', { name: 'Fechar simulador' }).click();
  await page.getByRole('button', { name: 'Versões' }).click();
  await expect(page.getByText('Versão 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar', exact: true }).last().click();
  await page.goto('/app/channels');
  await page.getByRole('button', { name: 'Adicionar simulador' }).click();
  await page.getByLabel('Nome da conexão').fill('Canal E2E');
  const connectionResponse = page.waitForResponse(
    (r) => r.url().includes('/api/connections') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Conectar canal' }).click();
  expect((await connectionResponse).status()).toBe(201);
  await expect(page.locator('.connection-row').filter({ hasText: 'Canal E2E' })).toContainText(
    'Conectado',
  );
  const connections = (await (
    await page.request.get(`/api/connections?workspaceId=${workspaceId}`)
  ).json()) as { id: string; name: string }[];
  const connectionId = connections.find((c) => c.name === 'Canal E2E')!.id;
  const ingress = async (text: string, id: string) => {
    expect(
      (
        await page.request.post(
          `/api/connections/${connectionId}/simulate?workspaceId=${workspaceId}`,
          {
            headers: origin,
            data: { text, externalContactId: 'e2e-client', externalMessageId: id },
          },
        )
      ).status(),
    ).toBe(202);
  };
  await ingress('/start', 'message-first');
  await ingress('/start', 'message-first');
  await page.goto('/app/inbox');
  await expect(
    page.locator('.inbox-conversation').filter({ hasText: 'Cliente de teste' }),
  ).toBeVisible();
  await page.locator('.inbox-conversation').filter({ hasText: 'Cliente de teste' }).click();
  await expect(page.locator('.inbox-message.outbound').first()).toContainText('Escolha uma opção');
  await expect(page.locator('.inbox-message.inbound')).toHaveCount(1);
  await ingress('Falar com a equipe', 'message-human');
  await expect(page.getByRole('button', { name: 'Devolver ao bot' })).toBeVisible();
  await page.getByLabel('Resposta ao cliente').fill('Olá! A Ana vai atender você.');
  await page.getByRole('button', { name: 'Enviar resposta' }).click();
  await expect(page.locator('.inbox-message.outbound').last()).toContainText('Ana vai atender');
  await expect(
    page.locator('.inbox-message.outbound').last().locator('.inbox-message-meta'),
  ).not.toContainText('Na fila');
  await page.getByRole('button', { name: 'Nota interna', exact: true }).click();
  await page.getByLabel('Nota interna', { exact: true }).fill('Cliente pediu um agendamento.');
  await page.getByRole('button', { name: 'Salvar nota interna' }).click();
  await expect(page.locator('.inbox-message.note')).toContainText('agendamento');
  await page.screenshot({ path: 'test-results/phase-two-inbox-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Devolver ao bot' }).click();
  await expect(page.getByRole('button', { name: 'Assumir conversa' })).toBeVisible();
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
  await expect(page.locator('.inbox-chat-heading')).toContainText('Encerrada');
  expect(
    (
      await page.request.patch(`/api/bots/${botId}?workspaceId=${workspaceId}`, {
        headers: { Origin: 'https://attacker.example' },
        data: { action: 'publish', revision: 1 },
      })
    ).status(),
  ).toBe(403);
  expect(errors).toEqual([]);
});
test('mobile editor, channels and Inbox keep controls within the viewport', async ({ page }) => {
  await page.goto('/login?demo=1');
  await page.getByRole('button', { name: /Preencher conta demo/ }).click();
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    '/app/templates',
    '/app/channels',
    '/app/bots/demo-bot-0/editor',
    '/app/inbox',
  ]) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      path,
    ).toBe(true);
  }
  await page.locator('.inbox-conversation').first().click();
  await expect(page.getByRole('button', { name: 'Voltar à lista de conversas' })).toBeVisible();
  await page.screenshot({ path: 'test-results/phase-two-inbox-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Voltar à lista de conversas' }).click();
  await expect(page.locator('.inbox-list')).toBeVisible();
  await page.goto('/app/bots/demo-bot-0/editor');
  await page.getByRole('button', { name: 'Testar', exact: true }).click();
  await page.getByRole('button', { name: 'Começar teste', exact: true }).click();
  await expect(page.locator('.simulator-bubble.outbound')).toBeVisible();
  await page.screenshot({ path: 'test-results/phase-two-editor-mobile.png', fullPage: true });
});
test('Telegram webhook verifies secret, deduplicates fixtures and never leaks credentials', async ({
  page,
}) => {
  const email = `webhook-${Date.now()}@e2e.bothub.local`;
  emails.push(email);
  expect(
    (
      await page.request.post('/api/auth/sign-up/email', {
        headers: origin,
        data: { name: 'Webhook Test', email, password: 'Local-E2E-Password-2026!' },
      })
    ).ok(),
  ).toBe(true);
  const ws = await page.request.post('/api/workspaces', {
    headers: origin,
    data: { name: 'Webhook workspace', segment: 'Serviços', timeZone: 'America/Sao_Paulo' },
  });
  const workspaceId = (await ws.json()).id;
  const { sealCredentials } = await import('../../packages/runtime/src/credentials');
  const connection = await db.connection.create({
    data: {
      workspaceId,
      channel: 'telegram',
      name: 'Existing fixture bot',
      status: 'pending',
      credentialCiphertext: sealCredentials({
        token: 'fixture-only-token',
        secretToken: 'fixture-only-secret',
      }),
    },
  });
  const payload = {
    update_id: 303,
    message: {
      message_id: 4,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 707, first_name: 'Fixture' },
      text: '/start',
    },
  };
  const path = `/api/webhooks/telegram/${connection.id}`;
  expect(
    (
      await page.request.post(path, {
        data: payload,
        headers: { 'X-Telegram-Bot-Api-Secret-Token': 'wrong' },
      })
    ).status(),
  ).toBe(401);
  expect(await db.webhookEvent.count({ where: { workspaceId, connectionId: connection.id } })).toBe(
    0,
  );
  for (let i = 0; i < 2; i++)
    expect(
      (
        await page.request.post(path, {
          data: payload,
          headers: { 'X-Telegram-Bot-Api-Secret-Token': 'fixture-only-secret' },
        })
      ).status(),
    ).toBe(200);
  expect(await db.webhookEvent.count({ where: { workspaceId, connectionId: connection.id } })).toBe(
    1,
  );
  expect(
    (
      await page.request.post(path, {
        data: { ...payload, text: 'a'.repeat(100001) },
        headers: { 'X-Telegram-Bot-Api-Secret-Token': 'fixture-only-secret' },
      })
    ).status(),
  ).toBe(413);
  const publicConnections = await (
    await page.request.get(`/api/connections?workspaceId=${workspaceId}`)
  ).json();
  expect(JSON.stringify(publicConnections)).not.toContain('fixture-only');
  expect(publicConnections[0]).not.toHaveProperty('credentialCiphertext');
  expect((await page.request.get('/api/connections?workspaceId=demo-workspace')).status()).toBe(
    403,
  );
});
