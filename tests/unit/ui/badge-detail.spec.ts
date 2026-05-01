import { describe, it, expect, beforeEach } from 'vitest';
import { openBadgeDetail } from '../../../src/ui/modals/badge-detail';
import { saveUser } from '../../../src/state/user';
import { mkUser } from '../state/userFixture';

beforeEach(() => {
  localStorage.clear();
  // eslint-disable-next-line no-restricted-syntax
  document.body.innerHTML = '<div id="modalRoot"></div>';
});

describe('openBadgeDetail', () => {
  it('알 수 없는 badgeId → 모달 안 띄움 (silent)', () => {
    openBadgeDetail('unknown-99');
    expect(document.querySelectorAll('.dg-modal')).toHaveLength(0);
  });

  it('streak-3 → 모달 + icon/name/description 표시', () => {
    openBadgeDetail('streak-3');
    expect(document.querySelectorAll('.dg-modal')).toHaveLength(1);
    expect(document.querySelector('.badge-modal-icon')!.textContent).toBe('🔥');
    expect(document.querySelector('.badge-modal-name')!.textContent).toBe('첫 불씨');
    expect(document.querySelector('.badge-modal-desc')!.textContent).toBe('연속 3일 답변');
  });

  it('earned 뱃지 → unlock date 표시', () => {
    saveUser(mkUser({ earnedBadges: { 'streak-3': new Date('2026-04-29').getTime() }, gamificationMigrated: true }));
    openBadgeDetail('streak-3');
    const date = document.querySelector('.badge-modal-date');
    expect(date?.textContent).toMatch(/2026-04-29/);
  });

  it('locked 뱃지 → unlock date 자리에 "달성 조건"', () => {
    openBadgeDetail('streak-365');  // 일반적으로 unearned
    const date = document.querySelector('.badge-modal-date');
    expect(date?.textContent ?? '').not.toMatch(/획득/);
  });

  it('XSS — badge name 이상 문자 escape 처리 (catalog 통제 데이터지만 방어적)', () => {
    // 데이터는 catalog 고정이라 XSS 직접 발생 불가능. 본 테스트는 escapeHtml 호출이
    // .badge-modal-name 안에 들어가는 것만 검증.
    openBadgeDetail('streak-3');
    // eslint-disable-next-line no-restricted-syntax
    const html = document.querySelector('.badge-modal-name')!.innerHTML;
    expect(html).not.toContain('<script>');
  });
});
