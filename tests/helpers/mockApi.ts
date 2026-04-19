import type { Page } from '@playwright/test';
import gemini from '../fixtures/api/gemini.json' with { type: 'json' };
import rss from '../fixtures/api/rss.json' with { type: 'json' };

type MockKind = 'question' | 'feedback' | 'chat' | 'evaluation' | 'keyTest';

export async function mockExternalApis(page: Page): Promise<void> {
  // rss2json
  await page.route('**/api.rss2json.com/**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rss) });
  });

  // Gemini — rotate response based on prompt substring
  await page.route('**/generativelanguage.googleapis.com/**', async route => {
    const body = route.request().postData() ?? '';
    let kind: MockKind = 'chat';
    if (body.includes('질문') || body.includes('오늘의')) kind = 'question';
    else if (body.includes('피드백') || body.includes('feedback')) kind = 'feedback';
    else if (body.includes('평가') || body.includes('점수')) kind = 'evaluation';
    else if (body.length < 200) kind = 'keyTest';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify((gemini as Record<string, unknown>)[kind]),
    });
  });
}

export async function seedLocalStorage(page: Page, data: Record<string, unknown>): Promise<void> {
  await page.addInitScript(payload => {
    for (const [k, v] of Object.entries(payload)) {
      localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  }, data);
}
