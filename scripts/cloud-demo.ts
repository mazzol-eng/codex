import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';
import { codespaceOrigin } from '../config/cloud-preview';
import { isProcessAlive } from './local-process';

if (process.platform === 'win32' || process.env.NODE_ENV === 'production')
  throw new Error('demo:cloud is for Linux/macOS development only.');
const origin = codespaceOrigin();
const root = process.cwd();
mkdirSync(resolve(root, '.data'), { recursive: true, mode: 0o700 });
const lock = resolve(root, '.data/cloud-demo.pid');
if (existsSync(lock)) {
  const pid = Number(readFileSync(lock, 'utf8').trim());
  if (!Number.isInteger(pid) || pid <= 1)
    throw new Error('Inspect the invalid cloud demo PID file.');
  if (isProcessAlive(pid)) {
    console.log('The cloud demo process is already running. Check Ports → BotHub.');
    process.exit(0);
  }
  unlinkSync(lock);
}
writeFileSync(lock, String(process.pid), { mode: 0o600, flag: 'wx' });
const children = new Set<ChildProcess>();
let stopping = false;
const environment = {
  ...process.env,
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://bothub:bothub_local@127.0.0.1:5432/bothub',
  QUEUE_MODE: 'memory',
  EMAIL_MODE: 'fake',
  PUBLIC_WEBHOOK_URL: '',
  BETTER_AUTH_URL: origin ?? 'http://localhost:3000',
};

function shutdown(code: number) {
  if (stopping) return;
  stopping = true;
  const pending = [...children];
  for (const child of pending) {
    if (!child.pid) continue;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH')
        console.error('Service shutdown failed.');
    }
  }
  const force = setTimeout(() => {
    for (const child of children) {
      if (!child.pid) continue;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {}
    }
    process.exit(code);
  }, 10000);
  Promise.all(
    pending.map((child) => new Promise<void>((done) => child.once('close', () => done()))),
  ).then(() => {
    clearTimeout(force);
    process.exit(code);
  });
}
process.on('exit', () => {
  if (existsSync(lock) && readFileSync(lock, 'utf8').trim() === String(process.pid))
    unlinkSync(lock);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => shutdown(0));

function run(args: string[], persistent = false, allowCleanExit = false): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn('pnpm', args, {
      cwd: root,
      env: environment,
      stdio: 'inherit',
      detached: true,
    });
    children.add(child);
    child.once('error', (error) => {
      if (persistent) {
        console.error('Demo service could not start.');
        shutdown(1);
      } else fail(error);
    });
    child.once('close', (code) => {
      children.delete(child);
      if (stopping) return;
      if (code !== 0 || (persistent && !allowCleanExit)) {
        const error = new Error(`Demo service ${args.join(' ')} exited unsuccessfully.`);
        if (persistent) {
          console.error(error.message);
          shutdown(1);
        } else fail(error);
      } else done();
    });
    if (persistent) done();
  });
}
try {
  const occupied = await new Promise<boolean>((done, fail) => {
    const socket = createConnection({ host: '127.0.0.1', port: 3000 });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ECONNREFUSED') done(false);
      else fail(error);
    });
  });
  if (occupied)
    throw new Error('Port 3000 is in use. Stop the existing dev server before demo:cloud.');
  await run(['services:local'], true, true);
  await run(['--filter', '@bothub/db', 'wait']);
  await run(['db:seed']);
  await run(['dev'], true);
  const deadline = Date.now() + 45000;
  let ready = false;
  while (Date.now() < deadline && !stopping) {
    try {
      const response = await fetch('http://127.0.0.1:3000/health', {
        signal: AbortSignal.timeout(2000),
      });
      const health = await response.json();
      if (response.ok && health.service === 'bothub-web' && health.database === 'ok') {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((done) => setTimeout(done, 500));
  }
  if (!ready) throw new Error('Cloud demo did not become healthy within 45 seconds.');
  console.log('BotHub demo is healthy. Open Ports → BotHub, then login?demo=1.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Cloud demo startup failed.');
  shutdown(1);
}
