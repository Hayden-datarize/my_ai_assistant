import { test, expect } from '@playwright/test';
import { primeOnboardedUser } from '../helpers/seed';

test.use({ serviceWorkers: 'block' });

test.describe('Slack settings (v3.19 email + autoSend)', () => {
  test('이메일 입력 → 저장 → 자동전송 toggle', async ({ page }) => {
    await primeOnboardedUser(page);
    // /api/sendAnswerDm 호출은 모두 200 mock (테스트 버튼 누르면 호출됨)
    await page.route('**/api/sendAnswerDm', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    );

    await page.goto('/');
    await page.locator('#bottomNav button[data-tab-id="settings"]').click();

    const input = page.locator('#slackEmailInput');
    await input.fill('me@datarize.ai');
    await page.click('#saveSlackBtn');

    // autoSend row 노출
    await expect(page.locator('#slackAutoRow')).toBeVisible();
    await page.click('#slackAutoToggle');

    // localStorage에 저장 확인
    const stored = await page.evaluate(() => localStorage.getItem('dg_slack'));
    expect(stored).toContain('me@datarize.ai');
    expect(stored).toContain('"autoSend":true');
  });

  test('비-@datarize.ai 이메일 거부', async ({ page }) => {
    await primeOnboardedUser(page);
    await page.goto('/');
    await page.locator('#bottomNav button[data-tab-id="settings"]').click();

    await page.locator('#slackEmailInput').fill('me@gmail.com');
    await page.click('#saveSlackBtn');

    const result = await page.locator('#slackTestResult').textContent();
    expect(result).toMatch(/datarize\.ai/);

    const stored = await page.evaluate(() => localStorage.getItem('dg_slack'));
    expect(stored).toBeNull();
  });
});
