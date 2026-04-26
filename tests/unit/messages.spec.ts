import { describe, it, expect } from 'vitest';
import { MSG } from '../../src/ui/messages';

describe('MSG (i18n Lite)', () => {
  it('all string members end with a period', () => {
    const stringEntries = Object.entries(MSG).filter(([, v]) => typeof v === 'string');
    for (const [key, val] of stringEntries) {
      expect(val, `MSG.${key}`).toMatch(/\.$/);
    }
  });

  it('uses casual ~해요 tone (no formal ~합니다 / nominal ~됨)', () => {
    const stringEntries = Object.entries(MSG).filter(([, v]) => typeof v === 'string');
    for (const [key, val] of stringEntries) {
      expect(val, `MSG.${key}`).not.toMatch(/합니다\.?$|됩니다\.?$|됨\.?$/);
    }
  });

  it('partialTranslateFail interpolates count', () => {
    expect(MSG.partialTranslateFail(3)).toContain('(3건)');
    expect(MSG.partialTranslateFail(3)).toMatch(/\.$/);
  });

  it('exposes expected keys', () => {
    expect(MSG.TRY_AGAIN).toBeTruthy();
    expect(MSG.SAVE_SUCCESS).toBeTruthy();
    expect(MSG.AI_RESPONSE_FAIL).toBeTruthy();
    expect(MSG.DEMO_API_KEY_PROMPT).toBeTruthy();
    expect(MSG.INTERESTS_UPDATED).toBeTruthy();
    expect(MSG.ANSWER_SAVED).toBeTruthy();
  });
});
