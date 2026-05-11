/**
 * v3.14 T7: cross-interest-view mission trigger wiring (T10-B 2/2).
 *
 * renderBriefingCard 의 main link click → 카드 텍스트(sourceTitle/title/summary)가
 * user.interests 어느 것과도 매칭 안 되면 fireCrossInterestTrigger 호출.
 * - 일별 1회 dedup (sessionStorage 'cross-interest-fired-${todayIso}')
 * - 같은 click 핸들러 안에서 T6의 single-now 재사용 (codex P1-7).
 * - codex P1-4: false-negative coverage — 짧은 영어 토큰 ('AI') 포함된 본문은 매칭으로 판정.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Briefing } from '../../src/state/briefings';

const fakeBriefing = (over: Partial<Briefing> = {}): Briefing => ({
  id: 'b1',
  date: '2026-05-01',
  title: 'T',
  summary: 'S',
  url: 'https://x.test/1',
  read: false,
  scrapped: false,
  sourceTitle: 'X',
  memo: '',
  pinned: false,
  ...over,
});

describe('cross-interest-view trigger wiring (v3.14 T7)', () => {
  beforeEach(() => {
    vi.resetModules();
    // eslint-disable-next-line no-restricted-syntax -- trusted empty string, jsdom reset
    document.body.innerHTML = '';
    sessionStorage.clear();
    localStorage.clear();
    // user fixture: interests = ['ai_ml']만 선택. user.ts KEY = 'user' (NOT 'dg.user').
    // schemaVersion 3 + missions 채워야 isValidUserShape 통과 — migrateUserToV3 자연 통과.
    localStorage.setItem('user', JSON.stringify({
      name: 'T', interests: ['ai_ml'], onboardedAt: '2026-05-01', streak: 0,
      lastActiveDate: '', xp: 0, earnedBadges: {}, gamificationMigrated: true,
      schemaVersion: 3,
      missions: {
        active: [],
        cumulative: { dailyCount: 0, weeklyCount: 0, monthlyCount: 0 },
        lastDailySeed: '', currentWeekIso: '', currentMonthIso: '',
      },
    }));
  });

  it('fires fireCrossInterestTrigger when card text matches NO user interest', async () => {
    const fireSpy = vi.fn();
    vi.doMock('../../src/ui/handlers/missions-triggers', () => ({
      fireBriefingViewTrigger: vi.fn(),
      fireCrossInterestTrigger: fireSpy,
      fireArchiveRevisitTrigger: vi.fn(),
    }));

    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(fakeBriefing({
      id: 'b1', title: '인사제도 개편 동향',
      summary: '...', url: 'https://x.test/1',
      sourceTitle: 'HR Insider',
    }), 0);
    document.body.append(card);
    card.querySelector<HTMLAnchorElement>('a.card-main')!.click();

    expect(fireSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire when card text matches a user interest', async () => {
    const fireSpy = vi.fn();
    vi.doMock('../../src/ui/handlers/missions-triggers', () => ({
      fireBriefingViewTrigger: vi.fn(),
      fireCrossInterestTrigger: fireSpy,
      fireArchiveRevisitTrigger: vi.fn(),
    }));

    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(fakeBriefing({
      id: 'b2', title: 'AI 모델 최신 동향',
      summary: 'ML 엔지니어링', url: 'https://x.test/2',
      sourceTitle: 'AI Weekly',
    }), 1);
    document.body.append(card);
    card.querySelector<HTMLAnchorElement>('a.card-main')!.click();

    expect(fireSpy).not.toHaveBeenCalled();
  });

  it('fires AT MOST once per KST day across multiple cross-interest cards', async () => {
    const fireSpy = vi.fn();
    vi.doMock('../../src/ui/handlers/missions-triggers', () => ({
      fireBriefingViewTrigger: vi.fn(),
      fireCrossInterestTrigger: fireSpy,
      fireArchiveRevisitTrigger: vi.fn(),
    }));

    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    for (let i = 0; i < 3; i++) {
      const card = renderBriefingCard(fakeBriefing({
        id: `b${i}`, title: '인사 정책 개편',
        summary: '회계', url: `https://x.test/${i}`,
        sourceTitle: 'HR Insider',
      }), i);
      document.body.append(card);
      card.querySelector<HTMLAnchorElement>('a.card-main')!.click();
    }
    expect(fireSpy).toHaveBeenCalledTimes(1);
  });

  // codex P1-4: 짧은 한국어 RSS 텍스트에서 interestKeywords 과다 매칭 가능성 검증.
  // ai_ml interest 사용자가 '재테크 ETF 동향' 같은 무관 카드 클릭 시 cross-interest로 판정돼야 함.
  it('cross-interest fires for realistic short Korean RSS title with no interest keyword', async () => {
    const fireSpy = vi.fn();
    vi.doMock('../../src/ui/handlers/missions-triggers', () => ({
      fireBriefingViewTrigger: vi.fn(),
      fireCrossInterestTrigger: fireSpy,
      fireArchiveRevisitTrigger: vi.fn(),
    }));
    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(fakeBriefing({
      id: 'b3',
      title: '재테크 ETF 시장 동향',
      summary: '연금저축과 IRP를 활용한 자산배분 전략',
      url: 'https://finance.test/1',
      sourceTitle: '경제 일보',
    }), 0);
    document.body.append(card);
    card.querySelector<HTMLAnchorElement>('a.card-main')!.click();
    expect(fireSpy).toHaveBeenCalledTimes(1);
  });

  // codex P1-4: interest='ai_ml' 인 사용자가 영어 'AI' 토큰만 본문에 있는 카드 클릭 시 매칭 — fire 안 함.
  it('cross-interest does NOT fire when only the bare keyword (AI) appears in summary', async () => {
    const fireSpy = vi.fn();
    vi.doMock('../../src/ui/handlers/missions-triggers', () => ({
      fireBriefingViewTrigger: vi.fn(),
      fireCrossInterestTrigger: fireSpy,
      fireArchiveRevisitTrigger: vi.fn(),
    }));
    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(fakeBriefing({
      id: 'b4',
      title: '신기술 동향',
      summary: 'GPT 같은 AI 도구가 업무에 미치는 영향',
      url: 'https://tech.test/1',
      sourceTitle: 'Tech News',
    }), 0);
    document.body.append(card);
    card.querySelector<HTMLAnchorElement>('a.card-main')!.click();
    expect(fireSpy).not.toHaveBeenCalled();
  });

  // codex T12 P1 (final review): 'ai' 짧은 토큰이 'daily', 'retail', 'training' 등
  // 무관 영단어 부분 문자열에 false-positive 매칭되어 cross-interest fire 안 되는 회귀.
  // matchKeyword(hay, 'ai')는 word-boundary로 'daily'를 매칭하지 않아야 한다.
  it('cross-interest fires for 영문 카드 with no real AI/ML keyword (daily/retail/training 부분 매칭 차단)', async () => {
    const fireSpy = vi.fn();
    vi.doMock('../../src/ui/handlers/missions-triggers', () => ({
      fireBriefingViewTrigger: vi.fn(),
      fireCrossInterestTrigger: fireSpy,
      fireArchiveRevisitTrigger: vi.fn(),
    }));
    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(fakeBriefing({
      id: 'b5',
      title: 'Daily training session for retail staff',
      summary: 'Customer engagement and team management practices',
      url: 'https://retail.test/1',
      sourceTitle: 'Retail Weekly',
    }), 0);
    document.body.append(card);
    card.querySelector<HTMLAnchorElement>('a.card-main')!.click();
    expect(fireSpy).toHaveBeenCalledTimes(1);
  });
});

describe('matchKeyword helper (v3.14 T13 / codex P1 final review)', () => {
  it('short ASCII keyword (≤3) uses word-boundary — does NOT match substring inside another word', async () => {
    const { matchKeyword } = await import('../../src/utils/interestKeywords');
    expect(matchKeyword('daily training session', 'ai')).toBe(false);
    expect(matchKeyword('retail digest', 'ai')).toBe(false);
    expect(matchKeyword('xml html document', 'ml')).toBe(false);
  });

  it('short ASCII keyword (≤3) matches when on word boundary', async () => {
    const { matchKeyword } = await import('../../src/utils/interestKeywords');
    expect(matchKeyword('ai 동향', 'ai')).toBe(true);
    expect(matchKeyword('ai-driven future', 'ai')).toBe(true);
    expect(matchKeyword('a study on ml engineering', 'ml')).toBe(true);
  });

  it('longer ASCII keyword (>3) uses substring includes — matches anywhere', async () => {
    const { matchKeyword } = await import('../../src/utils/interestKeywords');
    expect(matchKeyword('ai_ml etf 시장 동향', 'ai_ml')).toBe(true);
    expect(matchKeyword('hr_system 개편', 'hr_system')).toBe(true);
  });

  it('non-ASCII (Korean) keyword uses substring includes regardless of length', async () => {
    const { matchKeyword } = await import('../../src/utils/interestKeywords');
    expect(matchKeyword('인사제도 개편 동향', '인사제도')).toBe(true);
    expect(matchKeyword('자기계발 도서 추천', '자기')).toBe(true);  // 2자 한국어도 includes
  });
});
