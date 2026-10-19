import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  use: {
    baseURL: process.env.APP_URL || 'http://localhost:8081',
    viewport: { width: 412, height: 915 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  workers: 1,
  webServer: process.env.APP_URL ? undefined : {
    command: 'npx expo start --web --port 8081',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
