import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/utils/toast', () => ({
  showToast: vi.fn(),
}));

import { showToast } from '../../src/utils/toast';
import {
  showPartialTranslateFail,
  __resetToastDedupForTest,
} from '../../src/ui/translateToast';

describe('showPartialTranslateFail dedup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetToastDedupForTest();
  });

  it('shows toast once when called twice with same failedCount (dedup hit)', () => {
    showPartialTranslateFail(3);
    showPartialTranslateFail(3);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('(3건)'),
    );
  });

  it('shows toast twice when called with different failedCount (dedup miss)', () => {
    showPartialTranslateFail(3);
    showPartialTranslateFail(2);
    expect(showToast).toHaveBeenCalledTimes(2);
  });
});
