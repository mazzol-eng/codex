import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
const directory = resolve('.data/postgres');
mkdirSync(resolve('.data'), { recursive: true, mode: 0o700 });
const postgres = new EmbeddedPostgres({
  databaseDir: directory,
  user: 'bothub',
  password: 'bothub_local',
  port: 5432,
  persistent: true,
  authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1'],
  initdbFlags: ['--locale=C'],
  onLog: () => {},
  onError: () => {},
});
const probe = postgres.getPgClient('postgres', '127.0.0.1');
try {
  await probe.connect();
  await probe.query('SELECT 1');
  await probe.end();
  console.log('Local PostgreSQL is already ready on 127.0.0.1:5432.');
  process.exit(0);
} catch (error) {
  await probe.end().catch(() => {});
  if ((error as NodeJS.ErrnoException).code !== 'ECONNREFUSED')
    throw new Error(
      'Port 5432 is occupied or local database credentials differ. Stop the other service before using services:local.',
    );
}
const postmasterFile = resolve(directory, 'postmaster.pid');
if (existsSync(postmasterFile)) {
  const pid = Number(readFileSync(postmasterFile, 'utf8').split('\n')[0]);
  if (!Number.isInteger(pid) || pid <= 1)
    throw new Error('Invalid database PID file; inspect it before restarting.');
  try {
    process.kill(pid, 0);
    throw new Error('Database PID is still active. Inspect the running process before restarting.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    unlinkSync(postmasterFile);
  }
}
if (!existsSync(resolve(directory, 'PG_VERSION'))) await postgres.initialise();
await postgres.start();
const runnerFile = resolve('.data/postgres-runner.pid');
writeFileSync(runnerFile, String(process.pid), { mode: 0o600 });
const client = postgres.getPgClient('postgres', '127.0.0.1');
await client.connect();
const result = await client.query("SELECT 1 FROM pg_database WHERE datname = 'bothub'");
await client.end();
if (!result.rowCount) await postgres.createDatabase('bothub');
console.log(
  'Local PostgreSQL is ready on 127.0.0.1:5432. Ctrl+C stops the service without removing data.',
);
const timer = setInterval(() => {}, 60000);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, async () => {
    clearInterval(timer);
    await postgres.stop();
    if (existsSync(runnerFile) && readFileSync(runnerFile, 'utf8') === String(process.pid))
      unlinkSync(runnerFile);
    process.exit(0);
  });
