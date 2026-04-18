import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx http-server . -p 8080 -c-1',
    url: 'http://localhost:8080/daily-growth.html',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
