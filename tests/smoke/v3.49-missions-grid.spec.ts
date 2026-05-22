import { test, expect } from '@playwright/test';
import { primeOnboardedUser } from '../helpers/seed';

/**
 * v3.49 missions grid smoke.
 *
 * Codex P1-4 흡수: production localStorage key는 'user'(not 'dg:user'). 누락 필드(name,
 * plantStateByInterest, streakFreeze, insights, xpHistory, freezeHistory 등)를 채우려
 * primeOnboardedUser(schemaVersion: 2~4)로 seed 후 migration chain이 v10까지 끌어올린다.
 * missions.active만 별도 addInitScript로 merge (production missionEngine seedDailyPool
 * 정합 — sweep이 invalid한 seed를 정정하면 spec PASS 불가하므로 catalog 정확 id 사용).
 */
test.describe('v3.49 missions grid', () => {
  test.beforeEach(async ({ page }) => {
    // 1) 기본 onboarded user seed (migration chain이 v10까지 backfill)
    //    schemaVersion: 3 — v3.13 missions smoke 동일 패턴 (v4는 plantStateByInterest required, helper 미주입)
    await primeOnboardedUser(page, { interests: ['ai_ml'], schemaVersion: 3 });

    // 2) missions.active를 catalog 정확 id로 override (production sweep이 정정하기 전 첫 render에 노출 의도)
    //    Codex P1-4: 'daily-scrap' → 'daily-scrap-1' (catalog 실측 id)
    //    sweep override 차단: lastDailySeed/currentWeekIso/currentMonthIso를 production KST 값과 일치
    //    + weekly/monthly active를 빈 배열로 둠 → fixed 미션이 추가되지만 daily count 보존 (총 카드 수 변화 가능)
    //    → spec의 toHaveCount(2)는 daily 그룹 grid 카드 수 검증으로 좁힘 (.mission-group[data-period="daily"] .mission-card)
    await page.addInitScript(() => {
      const raw = localStorage.getItem('user');
      if (!raw) return;
      const u = JSON.parse(raw);

      // KST today YYYY-MM-DD (production: src/utils/intl.ts KST_FMT_DATE)
      const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

      // KST week ISO 'YYYY-Www' (production: getKSTWeekIso)
      const [yStr, mStr, dStr] = todayIso.split('-');
      const y = Number(yStr), m = Number(mStr), d = Number(dStr);
      const utc = new Date(Date.UTC(y, m - 1, d));
      const day = utc.getUTCDay() || 7;
      utc.setUTCDate(utc.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      const weekIso = `${utc.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;

      // KST month ISO 'YYYY-MM'
      const monthIso = todayIso.slice(0, 7);

      u.missions = {
        active: [
          { defId: 'daily-answer-1', period: 'daily', windowStart: 0, progress: 0, completed: false },
          { defId: 'daily-scrap-1',  period: 'daily', windowStart: 0, progress: 1, completed: true  },
        ],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: todayIso,
        currentWeekIso: weekIso,
        currentMonthIso: monthIso,
      };
      localStorage.setItem('user', JSON.stringify(u));
    });
  });

  test('missions 탭 진입 → grid 노출 + daily 그룹 카드 2개', async ({ page }) => {
    await page.goto('/');
    await page.locator('.bottom-nav .nav-item', { hasText: '미션' }).click();
    const grid = page.locator('.mission-group__grid').first();
    await expect(grid).toBeVisible({ timeout: 10_000 });
    // v3.49 T5 Codex 최종 N1: 전체 .mission-card 대신 [data-period="daily"]로 좁힘 (seed 정책 변경 강건성).
    const cards = page.locator('[data-period="daily"] .mission-card');
    await expect(cards).toHaveCount(2);
  });

  test('progress ring SVG 노출', async ({ page }) => {
    await page.goto('/');
    await page.locator('.bottom-nav .nav-item', { hasText: '미션' }).click();
    const ring = page.locator('circle.mission-card__ring-progress').first();
    await expect(ring).toBeVisible({ timeout: 10_000 });
    const dashoffset = await ring.getAttribute('stroke-dashoffset');
    expect(dashoffset).toMatch(/^[\d.]+$/);
  });

  test('완수 미션이 그룹 끝에 위치', async ({ page }) => {
    await page.goto('/');
    await page.locator('.bottom-nav .nav-item', { hasText: '미션' }).click();
    await expect(page.locator('.mission-card').first()).toBeVisible({ timeout: 10_000 });
    const cards = page.locator('.mission-card');
    await expect(cards.nth(0)).not.toHaveClass(/mission-card--completed/);
    await expect(cards.nth(1)).toHaveClass(/mission-card--completed/);
  });

  test('responsive: 360 viewport → 1열', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await page.locator('.bottom-nav .nav-item', { hasText: '미션' }).click();
    await expect(page.locator('.mission-card').first()).toBeVisible({ timeout: 10_000 });
    const columns = await page.locator('.mission-group__grid').first().evaluate(
      el => getComputedStyle(el).gridTemplateColumns,
    );
    expect(columns.split(' ').filter(s => s.trim().length > 0).length).toBe(1);
  });

  test('responsive: 500 viewport → 2열', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 800 });
    await page.goto('/');
    await page.locator('.bottom-nav .nav-item', { hasText: '미션' }).click();
    await expect(page.locator('.mission-card').first()).toBeVisible({ timeout: 10_000 });
    const columns = await page.locator('.mission-group__grid').first().evaluate(
      el => getComputedStyle(el).gridTemplateColumns,
    );
    expect(columns.split(' ').filter(s => s.trim().length > 0).length).toBe(2);
  });
});
