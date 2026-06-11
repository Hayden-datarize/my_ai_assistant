import { test, expect } from '@playwright/test';
import { primeOnboardedUser } from '../helpers/seed';

test.use({ serviceWorkers: 'block' });

async function seedUser(page: import('@playwright/test').Page): Promise<void> {
  await primeOnboardedUser(page, { interests: ['pm'] });
  await page.addInitScript(() => {
    // v3.3.4.3: suppress briefings auto-refresh (tests that need live fetch
    // mock it explicitly via page.route; this prevents unmocked specs from
    // hitting real RSS with a 5s timeout).
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
  });
}

test('briefing card hover applies translateY transform (v3.3.3 cardnews)', async ({ page }) => {
  await seedUser(page);
  await page.route('**/api.rss2json.com/**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        feed: { title: 'src' },
        items: [{ title: 'T', link: 'https://example.com/1', description: 'd', pubDate: '' }],
      }),
    }),
  );
  await page.goto('/');
  await expect(page.locator('#homeTab')).toBeVisible();
  await page.locator('#refreshBriefing').click();
  const card = page.locator('.briefing-card').first();
  await expect(card).toBeVisible({ timeout: 10_000 });

  const beforeHover = await card.evaluate((el) => getComputedStyle(el).transform);
  await card.hover();
  // v3.5: replace waitForTimeout(300) — poll computed transform until it reaches the
  // final translateY(-2px) value. Polling for the target pattern (not just "changed")
  // avoids sampling a mid-transition frame and decouples from the transition duration.
  await expect.poll(
    async () => card.evaluate((el) => getComputedStyle(el).transform),
    { timeout: 2000, intervals: [50, 100, 200] },
  ).toMatch(/matrix.*-2\s*\)|translate.*-2px/);
  const afterHover = await card.evaluate((el) => getComputedStyle(el).transform);

  expect(afterHover).not.toBe(beforeHover);
  expect(afterHover).not.toBe('none');
  expect(afterHover).toMatch(/matrix.*-2\s*\)|translate.*-2px/);
});

test('onboarding chip selected has non-default transform (scale)', async ({ page }) => {
  await page.addInitScript(() => { localStorage.removeItem('user'); });
  await page.goto('/');
  const chip = page.locator('.onboarding-chip').first();
  await expect(chip).toBeVisible({ timeout: 5_000 });
  const before = await chip.evaluate((el) => getComputedStyle(el).transform);
  await chip.click();
  const after = await chip.evaluate((el) => getComputedStyle(el).transform);

  expect(after).not.toBe(before);
  expect(after).not.toBe('none');
});

test('focus-visible on first focusable shows visible outline (keyboard tab)', async ({ page }) => {
  await seedUser(page);
  await page.goto('/');
  // v3.51 C4: hydration 완료(앱 mount + 첫 focusable 렌더) 대기 후 Tab. cold-start 시
  // hydration 전에 Tab이 눌리면 activeElement가 body에 남아 transient flake가 났다
  // (v3.49 retro 기록). 안정적인 다른 smoke와 동일하게 #homeTab visible을 마커로 대기.
  await expect(page.locator('#homeTab')).toBeVisible();
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    return { tag: el.tagName, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth };
  });
  expect(focused).not.toBeNull();
  expect(focused!.outlineStyle).not.toBe('none');
  expect(focused!.outlineWidth).not.toBe('0px');
});

test('disabled button has pointer-events: none', async ({ page }) => {
  await seedUser(page);
  await page.goto('/');
  // v3.42 T2 (C3 carry) + Codex 사전 P1-1: synthetic `<button class="btn">`을 직접 append.
  // 기존 `document.querySelector('button.btn')`은 onboarding/home DOM 단계마다 첫 element가
  // 달라질 수 있는 DOM order 의존이라 flake. CSS `.btn:disabled` rule 검증이 목적이라
  // production DOM 의존 없이 isolated element로 검증 — 가장 깨끗.
  const pe = await page.evaluate(() => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.setAttribute('disabled', '');
    document.body.appendChild(btn);
    // Force reflow — `:disabled` pseudo-class 즉시 평가 보장.
    void btn.offsetHeight;
    const result = getComputedStyle(btn).pointerEvents;
    btn.remove();  // cleanup
    return result;
  });
  expect(pe).toBe('none');
});
