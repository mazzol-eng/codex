import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
export function encryptCredential(value: string, key: string): string {
  const bytes = Buffer.from(key, 'hex');
  if (bytes.length !== 32) throw new Error('Encryption key must contain 32 bytes');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', bytes, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(
    '.',
  );
}
export function decryptCredential(value: string, key: string): string {
  const [iv, tag, data] = value.split('.');
  if (!iv || !tag || !data) throw new Error('Invalid encrypted credential');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString(
    'utf8',
  );
}
export function hashApiKey(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
