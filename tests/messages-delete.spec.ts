import { describe, it, expect } from 'vitest';
import { MSG } from '../src/ui/messages';

describe('MSG delete keys', () => {
  it('DELETE_CONFIRM_BULK formats with count', () => {
    expect(MSG.DELETE_CONFIRM_BULK(3)).toContain('3개');
    expect(MSG.DELETE_CONFIRM_BULK(3)).toContain('5초');
  });

  it('DELETE_CONFIRM_ALL formats with count', () => {
    expect(MSG.DELETE_CONFIRM_ALL(7)).toContain('7개');
    expect(MSG.DELETE_CONFIRM_ALL(7)).toContain('모두');
    expect(MSG.DELETE_CONFIRM_ALL(7)).toContain('5초');
  });

  it('exposes constant copy keys', () => {
    expect(MSG.DELETE_UNDO_TOAST).toBe('삭제되었어요.');
    expect(MSG.DELETE_UNDO_ACTION).toBe('되돌리기');
    expect(MSG.DELETE_UNDO_RESTORED).toBe('복원되었어요.');
    expect(MSG.DELETE_UNDO_FAILED).toBe('복원 실패했어요.');
  });
});

describe('MSG.SCRAP_* keys (v3.9)', () => {
  it('정의되어 있고 끝 마침표 규칙을 준수한다', () => {
    expect(MSG.SCRAP_UNDO_TOAST).toBe('스크랩을 해제했어요.');
    expect(MSG.SCRAP_UNDO_RESTORED).toBe('스크랩을 복원했어요.');
    expect(typeof MSG.SCRAP_BULK_CONFIRM).toBe('function');
    expect(MSG.SCRAP_BULK_CONFIRM(3)).toContain('3개');
    expect(typeof MSG.SCRAP_BULK_UNDO_TOAST).toBe('function');
    expect(MSG.SCRAP_BULK_UNDO_TOAST(3)).toContain('3개');
  });

  it('어조 일관성: 끝 마침표 + 캐주얼 ~했어요/~할까요', () => {
    expect(MSG.SCRAP_UNDO_TOAST.endsWith('.')).toBe(true);
    expect(MSG.SCRAP_UNDO_RESTORED.endsWith('.')).toBe(true);
    expect(MSG.SCRAP_BULK_CONFIRM(1).endsWith('.')).toBe(true);
    expect(MSG.SCRAP_BULK_UNDO_TOAST(1).endsWith('.')).toBe(true);
  });
});
