import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { PrismaClient } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
const root = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../..');
config({ path: resolve(root, '.env'), quiet: true });
const globalDb = globalThis as unknown as { bothubDb?: PrismaClient };
export const db =
  globalDb.bothubDb ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionTimeoutMillis: 5000,
      connectionString:
        process.env.DATABASE_URL ?? 'postgresql://bothub:bothub_local@localhost:5432/bothub',
    }),
  });
if (process.env.NODE_ENV !== 'production') globalDb.bothubDb = db;
export * from './repository';
