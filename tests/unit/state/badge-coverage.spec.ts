import { describe, it, expect } from 'vitest';
import { BADGE_CATALOG, type BadgeDef } from '../../../src/state/badgeCatalog';
import { CATEGORY_ORDER } from '../../../src/ui/handlers/stats';

describe('CATEGORY_ORDER ↔ BadgeDef.category 커버리지 (v3.13.1 T10 / carry-forward T8)', () => {
  it('CATEGORY_ORDER는 BADGE_CATALOG의 모든 category를 빠짐없이 포함한다', () => {
    const categoriesInCatalog = new Set(BADGE_CATALOG.map(b => b.category));
    const ordered = new Set<string>(CATEGORY_ORDER);
    for (const cat of categoriesInCatalog) {
      expect(ordered.has(cat)).toBe(true);
    }
  });

  it('CATEGORY_ORDER의 모든 항목은 실제 BadgeDef.category 값과 매칭된다 (dead category 차단)', () => {
    const categoriesInCatalog = new Set(BADGE_CATALOG.map(b => b.category));
    for (const cat of CATEGORY_ORDER) {
      expect(categoriesInCatalog.has(cat as BadgeDef['category'])).toBe(true);
    }
  });
});
