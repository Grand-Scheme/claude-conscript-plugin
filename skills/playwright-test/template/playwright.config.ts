import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './studies',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1, // Prevent cross-test participant matching
  retries: 0, // Retries would corrupt server state (extra participants)
  use: {
    baseURL: process.env.SERVER_URL || 'http://127.0.0.1:5100',
  },
  projects: [
    { name: 'chromium', use: { channel: 'chromium' } },
  ],
});
