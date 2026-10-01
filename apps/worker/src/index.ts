import { config } from 'dotenv';
import { logger } from '@bothub/core';
config({ path: '../../.env', quiet: true });
// There are no processing jobs in Phase 1. Do not consume future job types silently.
logger.info(
  { service: 'worker', phase: 1 },
  'Worker initialized; channel processing starts in Phase 2',
);
const keepAlive = setInterval(() => {}, 60000);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    clearInterval(keepAlive);
    process.exit(0);
  });
