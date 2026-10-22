import { defineConfig } from '@playwright/test';
import path from 'node:path';

// A dedicated build/server avoids accidentally checking Vite's more permissive
// development headers. Keep all generated evidence outside source control.
const evidence = path.resolve(import.meta.dirname, '../../generated-artifacts/script-runtime');
export default defineConfig({
  testDir: './tests/runtime',
  timeout: 240_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: path.join(evidence, 'results'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(evidence, 'report'), open: 'never' }],
    ['json', { outputFile: path.join(evidence, 'report.json') }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    headless: true,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
        },
      },
    },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'pnpm run build && pnpm run serve',
    env: { PORT: '4174', BASE_PATH: '/', NODE_ENV: 'production' },
    url: 'http://127.0.0.1:4174',
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
