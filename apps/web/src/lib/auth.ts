import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins';
import { hash, verify } from 'argon2';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { db } from '@bothub/db';
import { brand } from '../../../../config/brand';
import { FakeEmail, HttpEmail, logger, type EmailPort } from '@bothub/core';
const secretPath = resolve(process.cwd(), '../../.data/auth-secret');
const mailboxPath = resolve(process.cwd(), '../../.data/last-email.json');
function getSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.BOTHUB_BUILD === '1') return randomBytes(48).toString('base64url');
  if (process.env.NODE_ENV === 'production')
    throw new Error('AUTH_SECRET is required in production');
  mkdirSync(dirname(secretPath), { recursive: true, mode: 0o700 });
  if (!existsSync(secretPath)) {
    try {
      writeFileSync(secretPath, randomBytes(48).toString('base64url'), { mode: 0o600, flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
  return readFileSync(secretPath, 'utf8');
}
class LocalEmail extends FakeEmail {
  override async send(message: Parameters<EmailPort['send']>[0]) {
    await super.send(message);
    if (process.env.NODE_ENV === 'production')
      throw new Error('Configure real email delivery in production');
    mkdirSync(dirname(mailboxPath), { recursive: true, mode: 0o700 });
    writeFileSync(mailboxPath, JSON.stringify(message), { mode: 0o600 });
  }
}
const mail: EmailPort =
  process.env.EMAIL_MODE === 'real'
    ? new HttpEmail(
        process.env.EMAIL_ENDPOINT ?? 'https://api.resend.com/emails',
        process.env.EMAIL_API_KEY ?? '',
        process.env.EMAIL_FROM ?? `${brand.name} <hello@example.com>`,
      )
    : new LocalEmail();
export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);
export const auth = betterAuth({
  appName: brand.name,
  logger: {
    level: 'error',
    log() {
      logger.error({ service: 'auth' }, 'Authentication request failed');
    },
  },
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: getSecret(),
  database: prismaAdapter(db, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    password: {
      hash: (password) => hash(password),
      verify: ({ hash: stored, password }) => verify(stored, password),
    },
    sendResetPassword: async ({ user, url }) =>
      mail.send({
        to: user.email,
        subject: `Redefina sua senha no ${brand.name}`,
        text: `Olá, ${user.name}. Redefina sua senha: ${url}`,
      }),
    revokeSessionsOnPasswordReset: true,
  },
  account: { encryptOAuthTokens: true },
  verification: { storeIdentifier: 'hashed' },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    storage: 'memory',
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/request-password-reset': { window: 60, max: 3 },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production' || process.env.CODESPACES === 'true',
    defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
  },
  plugins: [twoFactor({ issuer: brand.name }), nextCookies()],
});
