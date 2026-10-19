import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/personal',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: process.env.APP_URL || 'http://localhost:4177',
    viewport: { width: 412, height: 915 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
