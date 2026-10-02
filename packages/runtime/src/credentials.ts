import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { encryptCredential, decryptCredential } from '@bothub/core';
export function encryptionKey() {
  const configured = process.env.ENCRYPTION_KEY;
  if (configured) {
    if (!/^[a-f\d]{64}$/i.test(configured)) throw new Error('ENCRYPTION_KEY must be 32-byte hex');
    return configured;
  }
  if (process.env.NODE_ENV === 'production')
    throw new Error('ENCRYPTION_KEY is required in production');
  const root = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
    ? process.cwd()
    : resolve(process.cwd(), '../..');
  const dir = resolve(root, '.data');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = resolve(dir, 'encryption-key');
  if (!existsSync(path)) {
    try {
      writeFileSync(path, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
  }
  return readFileSync(path, 'utf8').trim();
}
export function sealCredentials(value: Record<string, string>) {
  return encryptCredential(JSON.stringify(value), encryptionKey());
}
export function openCredentials(ciphertext: string): Record<string, string> {
  return JSON.parse(decryptCredential(ciphertext, encryptionKey())) as Record<string, string>;
}
