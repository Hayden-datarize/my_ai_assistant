import { describe, it, expect, beforeEach } from 'vitest';
import { takeSnapshot } from '../../../src/state/achievements';
import { saveBriefings, type Briefing } from '../../../src/state/briefings';
import { saveUser } from '../../../src/state/user';
import { mkUser } from './userFixture';

function mkBriefing(overrides: Partial<Briefing>): Briefing {
  return {
    id: 'b1',
    date: '2026-05-01',
    title: '',
    summary: '',
    url: 'https://example.com/x',
    sourceTitle: 'example',
    scrapped: true,
    read: false,
    memo: '',
    ...overrides,
  };
}

describe('categorizeScrapsByInterest — short-token false-positive 차단 (v3.14.1 T2)', () => {
  beforeEach(() => localStorage.clear());

  it('ai_ml interest의 keyword "ai"가 "daily training" 텍스트에 매칭되지 않는다', () => {
    saveUser(mkUser({ interests: ['ai_ml'], gamificationMigrated: true }));
    saveBriefings([
      mkBriefing({ id: 'b1', title: 'daily training session', summary: 'retail digest' }),
    ]);
    const snap = takeSnapshot();
    expect(snap.engagedInterests.has('ai_ml')).toBe(false);
  });

  it('ai_ml interest는 "AI 동향 정리" 텍스트에 매칭된다 (true-positive 유지)', () => {
    saveUser(mkUser({ interests: ['ai_ml'], gamificationMigrated: true }));
    saveBriefings([
      mkBriefing({ id: 'b2', title: 'AI 동향 정리', summary: 'ml engineering 사례' }),
    ]);
    const snap = takeSnapshot();
    expect(snap.engagedInterests.has('ai_ml')).toBe(true);
  });

  it('한국어 interest(hr_system)는 non-ASCII이므로 includes 유지 — "인사제도 개편" 매칭', () => {
    saveUser(mkUser({ interests: ['hr_system'], gamificationMigrated: true }));
    saveBriefings([
      mkBriefing({ id: 'b3', title: '인사제도 개편 동향', summary: '' }),
    ]);
    const snap = takeSnapshot();
    expect(snap.engagedInterests.has('hr_system')).toBe(true);
  });
});
