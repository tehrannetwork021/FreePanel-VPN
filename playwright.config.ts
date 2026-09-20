import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:43173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @tehrannetwork/panel dev --port 43173',
      url: 'http://127.0.0.1:43173',
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @tehrannetwork/installer dev --port 43174',
      url: 'http://127.0.0.1:43174',
      reuseExistingServer: false,
    },
  ],
});
