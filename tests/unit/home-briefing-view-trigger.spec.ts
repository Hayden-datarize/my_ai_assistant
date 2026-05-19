/**
 * v3.14 T6: briefing-view mission trigger wiring (T10-B 1/2).
 *
 * renderBriefingCard 의 main link click → fireBriefingViewTrigger 호출.
 * - 같은 카드 같은 KST 일자 재클릭은 sessionStorage flag로 차단 (codex P1-3).
 * - flag는 try 성공 후에만 set → Quota 등 throw 시 다음 click에서 재시도 허용.
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
  interestId: 'unknown',
  ...over,
});

describe('briefing-view trigger wiring (v3.14 T6)', () => {
  beforeEach(() => {
    vi.resetModules();
    // eslint-disable-next-line no-restricted-syntax -- trusted empty string, jsdom reset
    document.body.innerHTML = '';
    sessionStorage.clear();
    localStorage.clear();
  });

  it('fires fireBriefingViewTrigger on first click for a card', async () => {
    const fireSpy = vi.fn();
    vi.doMock('../../src/ui/handlers/missions-triggers', () => ({
      fireBriefingViewTrigger: fireSpy,
      fireCrossInterestTrigger: vi.fn(),
      fireArchiveRevisitTrigger: vi.fn(),
    }));

    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(fakeBriefing(), 0);
    document.body.append(card);
    card.querySelector<HTMLAnchorElement>('a.card-main')!.click();

    expect(fireSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire twice for the same card on the same KST day', async () => {
    const fireSpy = vi.fn();
    vi.doMock('../../src/ui/handlers/missions-triggers', () => ({
      fireBriefingViewTrigger: fireSpy,
      fireCrossInterestTrigger: vi.fn(),
      fireArchiveRevisitTrigger: vi.fn(),
    }));

    const { renderBriefingCard } = await import('../../src/ui/handlers/home');
    const card = renderBriefingCard(fakeBriefing(), 0);
    document.body.append(card);

    const link = card.querySelector<HTMLAnchorElement>('a.card-main')!;
    link.click();
    link.click();
    link.click();

    expect(fireSpy).toHaveBeenCalledTimes(1);
  });
});
