import { PrismaClient } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
const globalDb = globalThis as unknown as { bothubDb?: PrismaClient };
export const db =
  globalDb.bothubDb ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        process.env.DATABASE_URL ?? 'postgresql://bothub:bothub_local@localhost:5432/bothub',
    }),
  });
if (process.env.NODE_ENV !== 'production') globalDb.bothubDb = db;
export * from './repository';
