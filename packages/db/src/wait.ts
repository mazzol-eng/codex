import { db } from './index';
const deadline = Date.now() + 30000;
let ready = false;
while (Date.now() < deadline) {
  try {
    await db.$queryRaw`SELECT 1`;
    ready = true;
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
await db.$disconnect();
if (!ready)
  throw new Error(
    'PostgreSQL did not become ready within 30 seconds. Start Compose or pnpm services:local.',
  );
console.log('PostgreSQL is ready.');
