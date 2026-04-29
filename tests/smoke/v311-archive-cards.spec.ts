import { test, expect } from '@playwright/test';

// v3.11 T8 — archive 카드 visual upgrade smoke
// T6 답변 카드 풍부 layout(헤더/질문 preview/본문) + T5 스크랩 카드 home briefing 시각 재사용
test.describe('v3.11 archive cards visual upgrade', () => {
  test('답변 카드는 새 풍부 layout (헤더 + 질문 미리보기 + 본문)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('user', JSON.stringify({ interests: ['tech'] }));
      // briefings 자동 새로고침 억제 (외부 RSS fetch 방지)
      sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
      localStorage.setItem(
        'dg.answers',
        JSON.stringify([
          {
            id: 'a1',
            questionId: 'q1',
            text: '나의 성장 답변 본문 — 충분히 길어서 3줄 클램프가 작동하는 길이의 텍스트입니다.',
            authorId: 'self',
            questionText: '오늘 가장 중요한 우선순위는?',
            type: '분석',
            date: '2026-04-28',
            createdAt: '2026-04-28T00:00:00.000Z',
            schemaVersion: 1,
          },
        ])
      );
    });

    await page.goto('/');
    await page.locator('#bottomNav button[data-tab-id="archive"]').click();

    const card = page.locator('.archive-card--answer').first();
    await expect(card).toBeVisible();
    await expect(card.locator('.archive-card-header')).toBeVisible();
    await expect(card.locator('.archive-type-chip')).toContainText('분석');
    await expect(card.locator('.archive-card-question')).toContainText('오늘 가장 중요한 우선순위는?');
    await expect(card.locator('.archive-card-body')).toContainText('나의 성장 답변 본문');
    await expect(card.locator('.archive-card-delete')).toHaveAttribute('aria-label', '답변 삭제');
  });

  test('스크랩 카드는 home briefing 시각 (이미지 또는 이니셜 + 소스 뱃지 + 오버레이)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('user', JSON.stringify({ interests: ['tech'] }));
      sessionStorage.setItem('dg.briefings.auto-refresh-tried', '1');
      localStorage.setItem(
        'briefings',
        JSON.stringify([
          {
            id: 'b1',
            date: '2026-04-28',
            url: 'https://example.com/scrap1',
            title: '스크랩한 기사',
            summary: '요약 텍스트',
            scrapped: true,
            read: false,
            memo: '',
            sourceTitle: '예시소스',
          },
        ])
      );
    });

    await page.goto('/');
    await page.locator('#bottomNav button[data-tab-id="archive"]').click();
    // 스크랩 필터로 전환
    await page.locator('button.filter-chip[data-filter="scrap"]').click();

    const card = page.locator('.archive-card--scrap').first();
    await expect(card).toBeVisible();
    // briefing 카드 시각 = .card-overlay + .card-source 존재
    await expect(card.locator('.card-overlay')).toBeVisible();
    await expect(card.locator('.card-source')).toContainText('예시소스');
    // imageUrl 미설정 → .card-initial 만 존재 (.card-thumb 없음)
    await expect(card.locator('.card-thumb, .card-initial')).toHaveCount(1);
    // ✕ 버튼 — 스크랩 해제
    await expect(card.locator('.archive-card-delete')).toHaveAttribute('aria-label', '스크랩 해제');
  });
});
