import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // v3.2b-ui: existing smokes were written against mobile UX (bottom-nav).
    // v3.2b introduced a desktop sidebar at ≥768px that intercepts clicks in
    // the default 1280x720 viewport. Lock default to mobile; layout.spec.ts
    // opts into desktop via setViewportSize.
    viewport: { width: 375, height: 667 },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
