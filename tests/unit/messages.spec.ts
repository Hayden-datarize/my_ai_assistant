import { describe, it, expect } from 'vitest';
import { MSG } from '../../src/ui/messages';

// 버튼 라벨류, 섹션 타이틀, 단어형 스테이지 라벨 — UI 표준상 끝 마침표 X (메시지 톤 규칙 예외)
// v3.16 T5: GARDEN_SECTION_TITLE / GARDEN_STAGE_LABEL_* / GARDEN_TROPHY_LABEL은 src/ 미사용으로 제거됨
// (실제 UI는 plantCatalog.STAGE_LABEL을 사용). bundle trim 부수 효과.
const BUTTON_LABEL_KEYS = new Set([
  'DELETE_UNDO_ACTION',
  // v3.15 Garden — 모달 타이틀 / 버튼
  'GARDEN_INTRODUCE_TITLE',
  'GARDEN_CTA_VIEW',
  'GARDEN_CTA_CLOSE',
]);

describe('MSG (i18n Lite)', () => {
  it('all string message members end with a period (button labels exempt)', () => {
    const stringEntries = Object.entries(MSG).filter(
      ([k, v]) => typeof v === 'string' && !BUTTON_LABEL_KEYS.has(k),
    );
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
