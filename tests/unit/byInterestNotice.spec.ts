/**
 * v3.40 T7 (C5): maybeShowByInterestNotice — stats/archive 진입 시 one-time toast.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/utils/toast', () => ({
  showToast: vi.fn(),
  showUndoToast: vi.fn(),
  __setUndoTimerHandle: vi.fn(),
}));

import { maybeShowByInterestNotice } from '../../src/ui/handlers/byInterestNotice';
import { showToast } from '../../src/utils/toast';

const STORAGE_KEY = 'dg.toast.byInterestNotice';

describe('v3.40 T7 (C5) — maybeShowByInterestNotice', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('flag 미존재 시 toast show + flag set', () => {
    maybeShowByInterestNotice();
    expect(showToast).toHaveBeenCalledOnce();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it("flag === '1' 존재 시 toast skip", () => {
    localStorage.setItem(STORAGE_KEY, '1');
    maybeShowByInterestNotice();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("flag 비정상 값 ('0') 시 strict check로 show", () => {
    localStorage.setItem(STORAGE_KEY, '0');
    maybeShowByInterestNotice();
    expect(showToast).toHaveBeenCalledOnce();
  });

  it("flag 비정상 값 ('true') 시 strict check로 show", () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    maybeShowByInterestNotice();
    expect(showToast).toHaveBeenCalledOnce();
  });

  it('show 후 두 번째 호출은 skip (idempotent)', () => {
    maybeShowByInterestNotice();
    maybeShowByInterestNotice();
    expect(showToast).toHaveBeenCalledOnce();
  });

  it('toast message는 byInterest 의미 정정 안내 텍스트', () => {
    maybeShowByInterestNotice();
    const args = (showToast as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(args[0]).toContain('분야별 통계');
    expect(args[1]).toBe(4000); // DURATION_MS
  });
});
