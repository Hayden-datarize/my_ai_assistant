import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveAnswers,
  loadAnswers,
  deleteAnswerById,
  deleteAnswersByIds,
  deleteAllAnswers,
} from '../src/state/persistence';

const seed = () => {
  saveAnswers([
    { id: 'a', text: 'one' },
    { id: 'b', text: 'two' },
    { id: 'c', text: 'three' },
  ] as never);
};

beforeEach(() => {
  localStorage.clear();
});

describe('deleteAnswerById', () => {
  it('removes matching id and persists', () => {
    seed();
    deleteAnswerById('b');
    const after = loadAnswers();
    expect(after).toHaveLength(2);
    expect(after.find((a) => a.id === 'b')).toBeUndefined();
  });

  it('silent skip when id missing', () => {
    seed();
    deleteAnswerById('zzz');
    expect(loadAnswers()).toHaveLength(3);
  });

  it('propagates storage throw', () => {
    seed();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => deleteAnswerById('a')).toThrow(DOMException);
    setItem.mockRestore();
  });
});

describe('deleteAnswersByIds', () => {
  it('removes multiple matching ids atomically', () => {
    seed();
    deleteAnswersByIds(['a', 'c']);
    const after = loadAnswers();
    expect(after).toHaveLength(1);
    expect(after[0]?.id).toBe('b');
  });

  it('keeps others when partial match', () => {
    seed();
    deleteAnswersByIds(['a', 'unknown']);
    expect(loadAnswers().map((a) => a.id)).toEqual(['b', 'c']);
  });
});

describe('deleteAllAnswers', () => {
  it('clears array', () => {
    seed();
    deleteAllAnswers();
    expect(loadAnswers()).toEqual([]);
  });
});
