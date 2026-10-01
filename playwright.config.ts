import { defineConfig, devices } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const browserCache = resolve('.data/browser-cache');
mkdirSync(browserCache, { recursive: true, mode: 0o700 });
const packaged = process.platform === 'linux' && !process.env.PLAYWRIGHT_BROWSERS_PATH;
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: packaged
      ? {
          executablePath: await chromium.executablePath(),
          args: chromium.args.filter(
            (arg) => arg !== '--single-process' && arg !== '--disable-web-security',
          ),
          env: { ...process.env, XDG_CACHE_HOME: browserCache },
        }
      : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter @bothub/web dev',
    url: 'http://localhost:3000/health',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
