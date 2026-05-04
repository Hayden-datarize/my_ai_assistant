import { test, expect } from '@playwright/test';
import { primeUserWithGarden } from '../helpers/seed';

// v3.15 정원(Game World) smoke tests
//  g1: stats 탭에 #gardenSection + .garden-card 렌더 확인
//  g2: 홈 탭 #gardenMini 가시 + .garden-mini-cell 클릭 → stats 탭으로 전환 확인
//
// Fixture 전략:
//  - primeUserWithGarden: schemaVersion=4 + plantStateByInterest 주입
//  - gardenIntroduced=true → 환영 모달 억제
//  - lastActiveDate: KST 오늘 날짜 (Intl TZ-safe, v3.14.4 T3 패턴)

test.describe('v3.15 정원 smoke', () => {
  test('g1: stats 탭에 #gardenSection 보임 + .garden-card 최소 1개 렌더', async ({ page }) => {
    await primeUserWithGarden(page);
    await page.goto('/');
    // #bottomNav 스코프 — desktop-nav와 중복 방지 (boot.spec.ts 패턴)
    await page.locator('#bottomNav button[data-tab-id="stats"]').click();
    await expect(page.locator('#gardenSection')).toBeVisible();
    await expect(page.locator('.garden-card').first()).toBeVisible();
  });

  test('g2: 홈 탭 .garden-mini-row 보임 + .garden-mini-cell 클릭 → stats 탭으로 전환', async ({ page }) => {
    await primeUserWithGarden(page);
    await page.goto('/');
    // 홈 탭이 기본 active — renderGardenMini가 .garden-mini-row를 #gardenMini placeholder 안에 inject
    await expect(page.locator('.garden-mini-row')).toBeVisible();
    // 첫 번째 .garden-mini-cell 클릭 → dg:home:switch-tab { tab: 'stats' } dispatch
    await page.locator('.garden-mini-cell').first().click();
    // stats 탭으로 전환 후 #gardenSection 가시 확인
    await expect(page.locator('#gardenSection')).toBeVisible();
  });
});
