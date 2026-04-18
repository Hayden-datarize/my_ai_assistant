import { test, expect } from '@playwright/test';

test('app boots and shows home tab', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#homeTab')).toBeVisible();
});

test('archive tab switch works', async ({ page }) => {
  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  await expect(page.locator('#archiveTab')).toBeVisible();
});

test('settings tab opens api key status', async ({ page }) => {
  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="settings"]').click();
  await expect(page.locator('#apiKeyInput')).toBeVisible();
});

test('PWA assets are reachable (sw.js, manifest.json)', async ({ request }) => {
  const sw = await request.get('/sw.js');
  expect(sw.status(), 'sw.js must be served at /').toBe(200);
  expect(sw.headers()['content-type'] || '').toMatch(/javascript/);

  const manifest = await request.get('/manifest.json');
  expect(manifest.status(), 'manifest.json must be served at /').toBe(200);
  const body = await manifest.json();
  expect(body.start_url, 'manifest start_url').toBe('/');
});

test('all tabs load with zero CSP violations and zero page errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const cspViolations: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  await page.addInitScript(() => {
    (window as unknown as { __cspViolations: string[] }).__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      const event = e as SecurityPolicyViolationEvent;
      (window as unknown as { __cspViolations: string[] }).__cspViolations.push(
        `${event.violatedDirective} blocked ${event.blockedURI}`,
      );
    });
  });
  await page.goto('/');

  await expect(page.locator('#homeTab')).toBeVisible();
  await page.locator('#bottomNav button[data-tab-id="archive"]').click();
  await expect(page.locator('#archiveTab')).toBeVisible();
  await page.locator('#bottomNav button[data-tab-id="stats"]').click();
  await expect(page.locator('#statsTab')).toBeVisible();
  await page.locator('#bottomNav button[data-tab-id="settings"]').click();
  await expect(page.locator('#settingsTab')).toBeVisible();

  const collected = await page.evaluate(
    () => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? [],
  );
  cspViolations.push(...collected);

  expect(cspViolations, `CSP violations:\n${cspViolations.join('\n')}`).toEqual([]);
  expect(pageErrors, `Page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors, `Console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});
