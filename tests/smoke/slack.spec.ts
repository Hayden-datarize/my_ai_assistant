import { test, expect, type Page } from '@playwright/test';

// Block service workers for this file so page.route() reliably intercepts all network
// requests (the app's sw.js passes through hooks.slack.com via stale-while-revalidate).
test.use({ serviceWorkers: 'block' });

async function seedOnboardedUserWithApiKey(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({
      name: 'TestUser', interests: ['ai_ml'],
      onboardedAt: '2026-04-01', streak: 3, lastActiveDate: '', xp: 120, level: 2,
      gardenIntroduced: true,
    }));
    localStorage.setItem('dg_gemini_key', 'test-key-long-enough-for-validation');
    // Seed today's question cache so submit-answer test doesn't hit Gemini /question endpoint
    const todayKey = (() => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `dg.todayQuestion.${y}-${m}-${day}`;
    })();
    localStorage.setItem(todayKey, JSON.stringify({ type: 'reflection', question: '오늘 가장 인상 깊었던 순간은?', hint: 'H' }));
    // v3.3.4.3: suppress briefings auto-refresh (no briefings fixture seeded).
    // Slack tests mock hooks.slack.com via page.route but not rss2json.
    sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
  });
}

test('slack settings: save → reload → input persisted', async ({ page }) => {
  await seedOnboardedUserWithApiKey(page);
  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="settings"]').click();
  await expect(page.locator('#slackWebhookInput')).toBeVisible();
  await page.locator('#slackWebhookInput').fill('https://hooks.slack.com/services/AAA/BBB/CCC');
  await page.locator('#saveSlackBtn').click();
  await page.reload();
  await page.locator('#bottomNav button[data-tab-id="settings"]').click();
  await expect(page.locator('#slackWebhookInput')).toHaveValue('https://hooks.slack.com/services/AAA/BBB/CCC');
  await expect(page.locator('#slackAutoRow')).toBeVisible();
  await expect(page.locator('#clearSlackBtn')).toBeVisible();
});

test('slack test button: intercepts webhook, displays success, payload is valid Block Kit', async ({ page }) => {
  await seedOnboardedUserWithApiKey(page);
  let interceptedBody: string | null = null;
  await page.route('https://hooks.slack.com/**', async (route) => {
    interceptedBody = route.request().postData();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="settings"]').click();
  await page.locator('#slackWebhookInput').fill('https://hooks.slack.com/services/X/Y/Z');
  await page.locator('#testSlackBtn').click();
  await expect(page.locator('#slackTestResult')).toHaveText(/전송 성공/, { timeout: 10_000 });

  expect(interceptedBody).not.toBeNull();
  const payload = JSON.parse(interceptedBody as unknown as string) as {
    text: string;
    blocks: Array<{ type: string }>;
  };
  expect(payload.text).toMatch(/🌱 Daily Growth/);
  expect(payload.blocks[0]?.type).toBe('header');
  expect(payload.blocks.at(-1)?.type).toBe('context');
});

test('slack save rejects invalid URL with inline error message', async ({ page }) => {
  await seedOnboardedUserWithApiKey(page);
  await page.goto('/');
  await page.locator('#bottomNav button[data-tab-id="settings"]').click();
  await page.locator('#slackWebhookInput').fill('https://example.com/nope');
  await page.locator('#saveSlackBtn').click();
  await expect(page.locator('#slackTestResult')).toHaveText(/Slack Incoming Webhook URL 형식/);
});

test('auto-send gated OFF: answer submit does not POST to slack', async ({ page }) => {
  await seedOnboardedUserWithApiKey(page);
  await page.addInitScript(() => {
    localStorage.setItem('dg_slack', JSON.stringify({
      webhook: 'https://hooks.slack.com/services/X/Y/Z', autoSend: false,
    }));
  });
  let slackCalls = 0;
  await page.route('https://hooks.slack.com/**', async (route) => {
    slackCalls += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"score":4,"feedback":"좋은 성찰이에요."}' }] } }] }),
    });
  });

  await page.goto('/');
  await page.locator('#answerArea').fill('오늘 집중이 좋았다. 문서 정리에 두 시간을 썼다. 분산이 없었다.');

  // v3.5: replace waitForTimeout(4000) — wait for the Gemini evaluator response
  // (which is what gates whether slack would have been called). Once that returns,
  // slackCalls is final.
  const evalResponse = page.waitForResponse(/generativelanguage\.googleapis\.com/);
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('dg:home:submit-answer'));
  });
  await evalResponse;
  // Allow microtask tick after response so any post-evaluation slack call
  // would have been dispatched.
  await page.waitForFunction(() => true);
  expect(slackCalls).toBe(0);
});

test('auto-send gated ON: answer submit POSTs to slack with insight from evaluateAnswer', async ({ page }) => {
  await seedOnboardedUserWithApiKey(page);
  await page.addInitScript(() => {
    localStorage.setItem('dg_slack', JSON.stringify({
      webhook: 'https://hooks.slack.com/services/X/Y/Z', autoSend: true,
    }));
  });
  const slackBodies: string[] = [];
  await page.route('https://hooks.slack.com/**', async (route) => {
    const body = route.request().postData();
    if (body) slackBodies.push(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"score":4,"feedback":"좋은 성찰이에요."}' }] } }] }),
    });
  });

  await page.goto('/');
  await page.locator('#answerArea').fill('오늘 집중이 좋았다. 문서 정리에 두 시간을 썼다. 분산이 없었다.');
  // Dispatch the submit event directly — the bottomNav overlaps #submitBtn at the
  // viewport size Playwright uses (button sits behind fixed nav), so a plain click
  // (even with force:true) lands on the nav instead. Dispatching the same custom event
  // the click handler emits is semantically equivalent for this test.
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('dg:home:submit-answer'));
  });
  await expect.poll(() => slackBodies.length, { timeout: 7000 }).toBeGreaterThanOrEqual(1);

  const payload = JSON.parse(slackBodies[0]!) as { blocks: Array<{ type: string; text?: { text: string } }> };
  const hasDivider = payload.blocks.some((b) => b.type === 'divider');
  const hasInsightSection = payload.blocks.some((b) => b.type === 'section' && (b.text?.text ?? '').includes('인사이트'));
  expect(hasDivider).toBe(true);
  expect(hasInsightSection).toBe(true);
});
