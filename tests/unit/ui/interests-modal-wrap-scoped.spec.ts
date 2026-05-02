import { describe, it, expect, beforeEach } from 'vitest';

/**
 * v3.14.3 T7 (P2-2 / v3.14.2 P2-NEW-7) — interests/memo modals wrap-scoped queries.
 *
 * v3.14.2 T14에서 `openModal()` 반환값을 `void → HTMLDivElement`로 변경.
 * interests/memo 모달도 `document.getElementById/querySelectorAll` →
 * `wrap.querySelector/querySelectorAll`로 follow-up 마이그레이션.
 *
 * 본 spec은 nested-modal 경합 시나리오까지 커버하지 않고, 단일 modal 시점에서도
 * wrap-scoped query가 정상 동작함을 regression guard로 잠근다 (코드 패턴 통일).
 */
describe('interests/memo modals — wrap-scoped queries (v3.14.3 T7 P2-2)', () => {
  beforeEach(() => {
    localStorage.clear();
    // eslint-disable-next-line no-restricted-syntax -- jsdom DOM reset fixture; no user interpolation
    document.body.innerHTML = '<div id="modalRoot"></div><div class="toast-container"></div>';
  });

  it('interests modal opens, save button toggles based on selection', async () => {
    // v3 user fixture (schemaVersion=3) — getCachedUser bypasses migration.
    localStorage.setItem('user', JSON.stringify({
      name: 'T',
      interests: [],
      onboardedAt: '2026-04-01',
      streak: 0,
      lastActiveDate: '',
      xp: 0,
      earnedBadges: {},
      gamificationMigrated: true,
      schemaVersion: 3,
      missions: {
        active: [],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '',
        currentWeekIso: '',
        currentMonthIso: '',
      },
    }));

    const { openInterestsModal } = await import('../../../src/ui/modals/interests');
    openInterestsModal();

    const wrap = document.querySelector('.dg-modal');
    expect(wrap).not.toBeNull();

    const saveBtn = wrap?.querySelector('#saveInterestsBtn') as HTMLButtonElement | null;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn?.disabled).toBe(true); // 초기 — 선택 0개

    const firstBox = wrap?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(firstBox).not.toBeNull();
    firstBox!.checked = true;
    firstBox!.dispatchEvent(new Event('change'));
    expect(saveBtn?.disabled).toBe(false);
  });

  it('memo modal opens with existing memo content', async () => {
    localStorage.setItem('briefings', JSON.stringify([
      {
        id: 'b1', title: 'T', summary: 'S', url: 'https://x.com',
        sourceTitle: 'src', date: '2026-04-01',
        scrapped: false, read: false, memo: 'old memo',
      },
    ]));

    const { openMemoModal } = await import('../../../src/ui/modals/memo');
    openMemoModal(0);

    const wrap = document.querySelector('.dg-modal');
    expect(wrap).not.toBeNull();

    const input = wrap?.querySelector<HTMLTextAreaElement>('#memoInput');
    expect(input).not.toBeNull();
    expect(input?.value).toBe('old memo');
  });
});
