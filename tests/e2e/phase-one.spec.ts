import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../../packages/db/src/index';
const createdEmails: string[] = [];
const password = 'Local-E2E-Password-2026!';
test.afterAll(async () => {
  const users = await db.user.findMany({
    where: { email: { in: createdEmails } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await db.workspace.deleteMany({ where: { members: { some: { userId: { in: ids } } } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
test('public site, pricing, theme and anonymous protection', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Seu atendimento');
  await page.getByRole('button', { name: 'Alternar tema' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.goto('/precos');
  await expect(page.locator('.pricing-card').nth(1)).toContainText('R$ 99');
  await page.getByRole('button', { name: 'Anual' }).click();
  await expect(page.locator('.pricing-card').nth(1)).toContainText('79,20');
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/dashboard?workspaceId=demo-workspace')).status()).toBe(401);
});
test('registration, workspace onboarding and empty dashboard isolation', async ({ page }) => {
  const email = `signup-${Date.now()}@e2e.bothub.local`;
  createdEmails.push(email);
  await page.goto('/cadastro');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page.getByText('Digite seu nome completo.')).toBeVisible();
  await page.getByLabel('Seu nome').fill('Ana Teste');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel('Nome da empresa').fill('Empresa E2E');
  await page.getByLabel('Fuso horário').selectOption('America/Manaus');
  await page.getByRole('button', { name: 'Criar minha empresa' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: /Olá, Ana/ })).toBeVisible();
  await expect(page.getByText('Seu primeiro assistente está a caminho.')).toBeVisible();
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  const cross = await page.request.get('/api/dashboard?workspaceId=demo-workspace');
  expect(cross.status()).toBe(403);
  const switchCross = await page.request.patch('/api/workspaces', {
    headers: { Origin: 'http://localhost:3000' },
    data: { workspaceId: 'demo-workspace' },
  });
  expect(switchCross.status()).toBe(403);
  const csrf = await page.request.post('/api/workspaces', {
    headers: { Origin: 'https://attacker.example' },
    data: { name: 'Forged', segment: 'Serviços', timeZone: 'America/Sao_Paulo' },
  });
  expect(csrf.status()).toBe(403);
  const invalid = await page.request.post('/api/workspaces', {
    headers: { Origin: 'http://localhost:3000' },
    data: { name: 'A', segment: 'Invalid', timeZone: 'Bad' },
  });
  expect(invalid.status()).toBe(400);
  const account = await db.account.findFirstOrThrow({ where: { user: { email } } });
  expect(account.password).toMatch(/^\$argon2id\$/);
  expect(account.password).not.toBe(password);
  const sessionCookie = (await page.context().cookies()).find((c) =>
    c.name.includes('session_token'),
  );
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe('Lax');
  await page.getByRole('button', { name: 'Pesquisar...' }).click();
  await page.getByLabel('Pesquisar áreas').fill('Templates');
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Prontos para a sua próxima conversa' }),
  ).toBeVisible();
});
test('demo dashboard, filters, command palette and mobile navigation', async ({ page }) => {
  await page.goto('/login?demo=1');
  await page.getByRole('button', { name: /Preencher conta demo/ }).click();
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator('.demo-banner')).toBeVisible();
  const activeConversations = await db.conversation.count({
    where: { workspaceId: 'demo-workspace', status: 'open' },
  });
  await expect(page.locator('.metric-card').first()).toContainText(String(activeConversations));
  await page.getByLabel('Período do dashboard').selectOption('30');
  await expect(page.locator('.metric-card').nth(1)).toContainText('30 dias');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Pesquisar no painel' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('navigation', { name: 'Acesso rápido' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Menu de navegação' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar menu' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  await page
    .getByRole('navigation', { name: 'Acesso rápido' })
    .getByRole('link', { name: 'Meus bots' })
    .click();
  await expect(page.getByRole('heading', { name: 'Boas conversas começam aqui' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir editor' }).first()).toBeVisible();
});
test('login distinguishes rejected origins and unavailable server from incorrect credentials', async ({
  page,
}) => {
  let status = 403;
  await page.route('**/api/auth/sign-in/email', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({
        code: status === 403 ? 'INVALID_ORIGIN' : 'INTERNAL_SERVER_ERROR',
        diagnostic: {
          expectedOrigin: 'https://demo.example',
          receivedOrigin: 'http://localhost:3000',
        },
      }),
    }),
  );
  await page.goto('/login?demo=1');
  await page.getByRole('button', { name: /Preencher conta demo/ }).click();
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click();
  await expect(page.locator('.form-alert')).toContainText('Este endereço não foi autorizado');
  await expect(page.locator('.form-alert')).toContainText('Esperado: https://demo.example');
  await expect(page.locator('.form-alert')).toContainText('Recebido: http://localhost:3000');
  status = 500;
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click();
  await expect(page.locator('.form-alert')).toContainText(
    'O servidor não conseguiu concluir o login',
  );
  await expect(page.locator('.form-alert')).not.toContainText('Esperado:');
});
test('rejected login reports only origin diagnostics in development', async ({ request }) => {
  const response = await request.post('/api/auth/sign-in/email', {
    headers: { Origin: 'https://untrusted.example' },
    data: { email: 'demo@bothub.local', password: 'Wrong-Diagnostic-Password!' },
  });
  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toMatchObject({
    code: 'INVALID_ORIGIN',
    diagnostic: {
      expectedOrigin: 'http://localhost:3000',
      receivedOrigin: 'https://untrusted.example',
    },
  });
  const text = await response.text();
  expect(text).not.toContain('Wrong-Diagnostic-Password!');
  expect(text).not.toContain('demo@bothub.local');
});
test('password recovery with fake delivery, one-use token and revoked sessions', async ({
  page,
}) => {
  const email = `reset-${Date.now()}@e2e.bothub.local`;
  createdEmails.push(email);
  const signup = await page.request.post('/api/auth/sign-up/email', {
    headers: { Origin: 'http://localhost:3000' },
    data: { name: 'Reset Test', email, password },
  });
  expect(signup.ok()).toBe(true);
  await page.goto('/recuperar-senha');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
  await expect(page.getByRole('heading', { name: 'Confira seu e-mail.' })).toBeVisible();
  const message = JSON.parse(readFileSync(resolve('.data/last-email.json'), 'utf8')) as {
    to: string;
    text: string;
  };
  expect(message.to).toBe(email);
  const resetUrl = message.text.match(/https?:\/\/\S+/)?.[0];
  expect(resetUrl).toBeTruthy();
  await page.goto(resetUrl!);
  await expect(page.getByRole('heading', { name: 'Crie sua nova senha.' })).toBeVisible();
  await page.getByLabel('Nova senha').fill('Changed-E2E-Password-2026!');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByRole('heading', { name: 'Senha atualizada!' })).toBeVisible();
  await expect((await page.request.get('/api/auth/get-session')).json()).resolves.toBeNull();
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('Changed-E2E-Password-2026!');
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.goto(resetUrl!);
  await expect(page.getByText('Esse link não é válido ou expirou.')).toBeVisible();
});
test('mobile landing stays inside the viewport and has accessible navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Recursos', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Uma casa');
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/landing-mobile.png', fullPage: true });
});
