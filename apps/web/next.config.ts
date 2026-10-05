import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants';
import { resolve } from 'node:path';
import { codespaceOrigin } from '../../config/cloud-preview';
const config: NextConfig = {
  logging: { incomingRequests: false },
  devIndicators: false,
  transpilePackages: ['@bothub/db', '@bothub/core'],
  turbopack: { resolveAlias: { 'next-intl/config': './src/i18n/request.ts' } },
  webpack(config) {
    config.resolve.alias['next-intl/config'] = resolve(process.cwd(), 'src/i18n/request.ts');
    return config;
  },
  serverExternalPackages: ['argon2'],
  outputFileTracingExcludes: {
    '*': ['../../.data/**/*', '../../.pnpm-store/**/*', '../../.env*', '.env*'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
const getConfig = (phase: string) => {
  if (phase === PHASE_PRODUCTION_BUILD) process.env.BOTHUB_BUILD = '1';
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const origin = codespaceOrigin();
    if (origin) {
      process.env.BETTER_AUTH_URL = origin;
      return { ...config, allowedDevOrigins: [new URL(origin).hostname] };
    }
  }
  return config;
};
export default getConfig;
