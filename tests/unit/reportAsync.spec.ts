import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/utils/toast', () => ({
  showToast: vi.fn(),
}));

import { reportAsync } from '../../src/utils/reportAsync';
import { showToast } from '../../src/utils/toast';

describe('reportAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('resolve 시 원래 값을 그대로 통과시킨다', async () => {
    const result = await reportAsync('test-label', Promise.resolve(42));
    expect(result).toBe(42);
    expect(showToast).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('reject 시 console.warn + showToast를 호출하고 undefined를 반환한다', async () => {
    const err = new Error('chunk load failed');
    const result = await reportAsync('welcome-garden', Promise.reject(err));
    expect(result).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[reportAsync:welcome-garden]', err);
    expect(showToast).toHaveBeenCalledWith('welcome-garden 로드 실패 — 새로고침 해주세요');
  });

  it('showToast가 throw해도 catch하고 undefined를 반환한다 (boot race)', async () => {
    vi.mocked(showToast).mockImplementationOnce(() => {
      throw new Error('toast container not mounted');
    });
    const err = new Error('async failed');
    const result = await reportAsync('boot', Promise.reject(err));
    expect(result).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[reportAsync:boot]', err);
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it('non-Error rejection도 catch한다 (string/object 등)', async () => {
    const result = await reportAsync('weird', Promise.reject('plain string'));
    expect(result).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[reportAsync:weird]', 'plain string');
  });
});
