import { test, expect } from '@playwright/test';
import { getDateStr } from '../../src/utils/dates';

// Block service worker so tests don't hit stale caches and image-load
// routing via page.route works reliably (matches other briefing specs).
test.use({ serviceWorkers: 'block' });

type SeedBriefing = {
  id: string;
  date: string;
  url: string;
  title: string;
  summary: string;
  scrapped: boolean;
  read: boolean;
  memo: string;
  sourceTitle?: string;
  imageUrl?: string;
};

async function seedBriefings(
  page: import('@playwright/test').Page,
  items: SeedBriefing[],
): Promise<void> {
  const today = getDateStr();
  await page.addInitScript(
    ({ cards, today }) => {
      localStorage.setItem(
        'user',
        JSON.stringify({
          name: '테',
          interests: ['tech'],
          onboardedAt: new Date().toISOString(),
          streak: 0,
          lastActiveDate: today,
          xp: 0,
          level: 1,
        }),
      );
      localStorage.setItem('briefings', JSON.stringify(cards));
    },
    { cards: items, today },
  );
}

function mkCards(count: number, withImage: boolean): SeedBriefing[] {
  const today = getDateStr();
  return Array.from({ length: count }, (_, i) => ({
    id: `b${i}`,
    date: today,
    url: `https://example.com/article-${i}`,
    title: `제목 ${i}`,
    summary: `요약 내용 ${i}`,
    scrapped: false,
    read: false,
    memo: '',
    sourceTitle: `Source${String.fromCharCode(65 + i)}`, // SourceA, SourceB, ...
    ...(withImage
      ? { imageUrl: `https://picsum.photos/seed/${i}/400/500` }
      : {}),
  }));
}

test('5 briefing cards render in mobile grid (1 column)', async ({ page }) => {
  await seedBriefings(page, mkCards(5, true));
  await page.goto('/');
  const cards = page.locator('.briefing-card');
  await expect(cards).toHaveCount(5);

  // Mobile viewport (default 375) → 1 column
  const grid = page.locator('#briefingScroll');
  const cols = await grid.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns,
  );
  expect(cols.split(/\s+/).filter(Boolean).length).toBe(1);
});

test('tier 1: image rendered when imageUrl present', async ({ page }) => {
  await seedBriefings(page, mkCards(1, true));
  await page.goto('/');
  const first = page.locator('.briefing-card').first();
  await expect(first).toHaveAttribute('data-tier', '1');
  const img = first.locator('img.card-thumb');
  await expect(img).toHaveAttribute('src', /picsum/);
  // lazy/async + referrerpolicy attributes
  await expect(img).toHaveAttribute('loading', 'lazy');
  await expect(img).toHaveAttribute('decoding', 'async');
  await expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
});

test('tier 2: fallback when imageUrl absent (initial letter visible)', async ({ page }) => {
  await seedBriefings(page, mkCards(1, false));
  await page.goto('/');
  const first = page.locator('.briefing-card').first();
  await expect(first).toHaveAttribute('data-tier', '2');
  await expect(first.locator('img.card-thumb')).toHaveCount(0);
  const initial = first.locator('.card-initial');
  await expect(initial).toBeVisible();
  await expect(initial).toHaveText('S'); // SourceA.first()
});

test('tier 1 → tier 2 transition on image load error', async ({ page }) => {
  // Stub the failing image so we don't rely on DNS failure timing
  await page.route('**/invalid-host-that-does-not-exist.tld/**', (route) =>
    route.abort(),
  );

  const today = getDateStr();
  await seedBriefings(page, [
    {
      id: 'bad',
      date: today,
      url: 'https://x.com',
      title: 't',
      summary: 's',
      scrapped: false,
      read: false,
      memo: '',
      sourceTitle: 'Nowhere',
      imageUrl: 'https://invalid-host-that-does-not-exist.tld/img.jpg',
    },
  ]);
  await page.goto('/');

  // Wait for onerror to fire and tier to switch
  await page.waitForFunction(
    () =>
      document.querySelector('.briefing-card')?.getAttribute('data-tier') ===
      '2',
    undefined,
    { timeout: 10_000 },
  );

  const card = page.locator('.briefing-card').first();
  await expect(card).toHaveAttribute('data-tier', '2');
  await expect(card.locator('img.card-thumb')).toHaveCount(0);
  await expect(card.locator('.card-initial')).toHaveText('N');
});

test('memo modal: open → edit → save → persists', async ({ page }) => {
  await seedBriefings(page, mkCards(1, true));
  await page.goto('/');

  await page
    .locator('.briefing-card')
    .first()
    .locator('[data-action="memo"]')
    .click();
  await expect(page.locator('.dg-modal')).toBeVisible();
  await expect(page.locator('.dg-modal-title')).toHaveText('메모');

  const input = page.locator('#memoInput');
  await input.fill('E2E 테스트 메모');
  await page.locator('#saveMemoBtn').click();

  await expect(page.locator('.dg-modal')).toHaveCount(0);

  const memo = await page.evaluate(() => {
    const list = JSON.parse(
      localStorage.getItem('briefings') ?? '[]',
    ) as Array<{ memo: string }>;
    return list[0]?.memo;
  });
  expect(memo).toBe('E2E 테스트 메모');
});

test('memo modal: cancel does not persist', async ({ page }) => {
  await seedBriefings(page, [
    {
      id: 'b0',
      date: getDateStr(),
      url: 'https://x.com',
      title: 't',
      summary: 's',
      scrapped: false,
      read: false,
      memo: '원본 메모',
      sourceTitle: 'Src',
    },
  ]);
  await page.goto('/');

  await page
    .locator('.briefing-card')
    .first()
    .locator('[data-action="memo"]')
    .click();
  await page.locator('#memoInput').fill('변경 시도');
  await page.locator('#cancelMemoBtn').click();
  await expect(page.locator('.dg-modal')).toHaveCount(0);

  const memo = await page.evaluate(() => {
    const list = JSON.parse(
      localStorage.getItem('briefings') ?? '[]',
    ) as Array<{ memo: string }>;
    return list[0]?.memo;
  });
  expect(memo).toBe('원본 메모');
});

test('scrap button toggles is-scrapped class', async ({ page }) => {
  await seedBriefings(page, mkCards(1, true));
  await page.goto('/');

  const scrap = page
    .locator('.briefing-card')
    .first()
    .locator('[data-action="scrap"]');
  await expect(scrap).not.toHaveClass(/is-scrapped/);
  await scrap.click();
  await expect(scrap).toHaveClass(/is-scrapped/);
});

test('responsive: desktop (≥1024px) shows 3-column grid + 5th spans 2', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedBriefings(page, mkCards(5, true));
  await page.goto('/');

  const grid = page.locator('#briefingScroll');
  const cols = await grid.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns,
  );
  expect(cols.split(/\s+/).filter(Boolean).length).toBe(3);

  const fifth = page.locator('.briefing-card').nth(4);
  const gridColumn = await fifth.evaluate(
    (el) => getComputedStyle(el).gridColumn,
  );
  // Browsers report computed gridColumn variously; flexible match for "span 2"
  expect(gridColumn).toMatch(/span 2|\/\s*span 2|\/\s*3\s*$|\/\s*4\s*$/);
});

// v3.3.4.3: verify the 41/25 override holds across the full desktop range.
// Entering @media (min-width: 1024px) the 5th card spans 2 columns; without
// the aspect override it would compute ~2× the height of 1-col siblings.
// The A4 max-width:1200px cap + margin-inline:auto keep the grid track
// within a narrow band on wide viewports, which is why a single-viewport
// check was insufficient.
for (const width of [1024, 1280, 1440, 1920]) {
  test(`v3.3.4.3: 5th card height matches row siblings at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedBriefings(page, mkCards(5, true));
    await page.goto('/');

    const fourth = await page.locator('.briefing-card').nth(3).boundingBox();
    const fifth = await page.locator('.briefing-card').nth(4).boundingBox();
    expect(fourth).not.toBeNull();
    expect(fifth).not.toBeNull();
    expect(Math.abs(fourth!.height - fifth!.height)).toBeLessThan(2);
  });
}

test('v3.3.4.3: wide viewport 1920 caps briefing-scroll width and centers within #homeTab', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedBriefings(page, mkCards(5, true));
  await page.goto('/');

  const scroll = page.locator('#briefingScroll');
  const homeTab = page.locator('#homeTab');
  const sbox = await scroll.boundingBox();
  const hbox = await homeTab.boundingBox();
  expect(sbox).not.toBeNull();
  expect(hbox).not.toBeNull();
  // Cap 1200px (content-box via global box-sizing: border-box)
  expect(sbox!.width).toBeLessThanOrEqual(1200);
  // #homeTab desktop layout uses asymmetric padding (80px left for sidebar
  // reach, 20px right) — so viewport-relative centering is impossible by
  // design. Verify margin-auto centers within the parent's *content box*.
  const tabPad = await homeTab.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { left: parseFloat(cs.paddingLeft), right: parseFloat(cs.paddingRight) };
  });
  // Anchor the centering math to the documented asymmetric desktop padding.
  // If anyone changes #homeTab padding, the next two assertions fail loudly
  // before the centering math diverges silently.
  expect(tabPad.left).toBe(80);
  expect(tabPad.right).toBe(20);
  const leftInContent = sbox!.x - (hbox!.x + tabPad.left);
  const rightInContent = (hbox!.x + hbox!.width - tabPad.right) - (sbox!.x + sbox!.width);
  expect(Math.abs(leftInContent - rightInContent)).toBeLessThan(2);
});
