import { randomBytes } from 'node:crypto';
import { verify } from 'argon2';
import { codespaceOrigin } from '../../../config/cloud-preview';

if (process.env.NODE_ENV === 'production')
  throw new Error('demo:check is only available in development.');

// Match demo:cloud's local database, even when an unrelated .env file is present.
process.env.DATABASE_URL = 'postgresql://bothub:bothub_local@127.0.0.1:5432/bothub';
const { db } = await import('./index');

try {
  const origin = codespaceOrigin() ?? 'http://localhost:3000';
  console.log('Diagnóstico do login demo');
  console.log(`Endereço esperado: ${origin}`);
  const user = await db.user.findUnique({
    where: { email: 'demo@bothub.local' },
    select: { id: true, twoFactorEnabled: true },
  });
  const account = user
    ? await db.account.findUnique({
        where: { providerId_accountId: { providerId: 'credential', accountId: user.id } },
        select: { password: true },
      })
    : null;
  console.log(`Conta demo: ${user && account ? 'presente' : 'ausente'}`);
  if (account?.password) {
    const matches = await verify(account.password, 'BotHubDemo2026!');
    console.log(`Senha demo padrão: ${matches ? 'válida' : 'foi alterada'}`);
  } else console.log('Senha demo padrão: não cadastrada');
  console.log(`Verificação em duas etapas: ${user?.twoFactorEnabled ? 'ativada' : 'desativada'}`);

  // Deliberately use an incorrect password: this checks origin handling without creating a session.
  const response = await fetch('http://localhost:3000/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ email: 'demo@bothub.local', password: randomBytes(32).toString('hex') }),
    signal: AbortSignal.timeout(15000),
  });
  const body: unknown = await response.json().catch(() => null);
  const invalidCredentials =
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    body.code === 'INVALID_EMAIL_OR_PASSWORD';
  console.log(`Resposta da autenticação: HTTP ${response.status}`);
  if (response.status === 401 && invalidCredentials)
    console.log('O servidor aceita o endereço esperado. Nenhuma sessão foi criada pelo teste.');
  else if (response.status === 403)
    console.log('O servidor rejeitou o endereço. Reinicie com pnpm demo:cloud no Codespaces.');
  else if (response.status === 429)
    console.log('Limite de tentativas atingido. Aguarde um minuto antes de tentar novamente.');
  else console.log('A resposta requer investigação. Compartilhe somente este diagnóstico.');
} catch {
  console.log(
    'Não foi possível verificar o banco ou a autenticação. Confira se pnpm demo:cloud está ativo.',
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
