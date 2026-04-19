import { describe, it, expect } from 'vitest';
import { getCategoryLabel, INTERESTS } from '../../src/utils/categories';

describe('categories', () => {
  it('exposes all 15 legacy interests each with id + label + category', () => {
    expect(INTERESTS).toHaveLength(15);
    for (const i of INTERESTS) {
      expect(i.id).toMatch(/^[a-z_]+$/);
      expect(i.label.length).toBeGreaterThan(1);
      expect(['HR', 'Tech', 'Biz', 'General']).toContain(i.category);
    }
  });

  it('getCategoryLabel returns legacy label for known id (with emoji prefix)', () => {
    expect(getCategoryLabel('recruiting')).toBe('🎯 채용');
    expect(getCategoryLabel('leadership')).toBe('👑 리더십');
    expect(getCategoryLabel('self_dev')).toBe('🌱 자기계발');
  });

  it('getCategoryLabel returns "📰 일반" for unknown id (legacy fallback)', () => {
    expect(getCategoryLabel('nope-xxx')).toBe('📰 일반');
    expect(getCategoryLabel('')).toBe('📰 일반');
  });

  it('INTERESTS ids are unique', () => {
    const ids = INTERESTS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
