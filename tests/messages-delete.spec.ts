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
