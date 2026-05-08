import { describe, it, expect, beforeEach } from 'vitest';
import { getApiKey, API_KEY_STORAGE } from '../../../src/utils/apiKey';

describe('apiKey', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('미설정 시 빈 문자열 반환', () => {
    expect(getApiKey()).toBe('');
  });

  it('설정값을 그대로 반환', () => {
    localStorage.setItem(API_KEY_STORAGE, 'test-api-key-abc123');
    expect(getApiKey()).toBe('test-api-key-abc123');
  });
});
