import { describe, it, expect, beforeEach } from 'vitest';
import { renderArchive } from '../../src/ui/tabs/archive';
import { saveUser } from '../../src/state/user';
import { mkUser } from '../unit/state/userFixture';

/**
 * v3.27 T2a: insights tab 제거 + insights entity archive 통합 렌더 회귀.
 * - Codex 사전 review P0-5: nav.ts TABS / TabId / import 모두 제거.
 * - archive tab에 user.insights[]가 카드로 노출 (insights tab 폐기 후 데이터 anchor 유지).
 */

describe('v3.27 T2a: insights tab 제거 + insights entity archive 렌더', () => {
  beforeEach(() => { localStorage.clear(); });

  it('nav.ts TABS에 id="insights" entry 0 (P0-5)', async () => {
    const { TABS } = await import('../../src/ui/nav');
    expect(TABS.find(t => (t.id as string) === 'insights')).toBeUndefined();
  });

  it('nav.ts TABS id 목록에 "insights" 미포함 (TabId union runtime 검증)', async () => {
    const { TABS } = await import('../../src/ui/nav');
    const ids = TABS.map(t => t.id as string);
    expect(ids).not.toContain('insights');
  });

  it('archive tab에 user.insights 카드 렌더 (.archive-insight-card)', () => {
    saveUser(mkUser({ insights: [{ id: 'i1', text: 'insight 본문', interestId: 'tech', createdAt: '2026-05-10T00:00:00Z' }] }));
    const container = document.createElement('div');
    renderArchive(container);
    expect(container.querySelector('.archive-insight-card')).not.toBeNull();
  });

  it('archive insight 카드 — text 노출 + insightId data 속성', () => {
    saveUser(mkUser({ insights: [{ id: 'i1', text: '깊은 통찰 텍스트', interestId: 'tech', createdAt: '2026-05-10T00:00:00Z' }] }));
    const container = document.createElement('div');
    renderArchive(container);
    const card = container.querySelector<HTMLElement>('.archive-insight-card');
    expect(card?.textContent).toMatch(/깊은 통찰 텍스트/);
    expect(card?.dataset['insightId']).toBe('i1');
  });
});
