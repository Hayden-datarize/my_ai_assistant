/**
 * @vitest-environment jsdom
 *
 * v3.11 T6 — archive 답변 카드 풍부 layout (renderAnswerCard).
 * - .archive-card--answer modifier
 * - 헤더(유형 칩 + 날짜 + ✕)
 * - 질문 1줄 preview (questionText) — graceful degrade '질문 정보 없음'
 * - 답변 본문은 풀 텍스트 (CSS line-clamp 3 — JS truncation 안 함)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('archive answer card rich layout (v3.11 T6)', () => {
  it('renders question preview when questionText present', async () => {
    const { saveAnswers } = await import('../../src/state/persistence');
    const { makeAnswer } = await import('../../src/state/schema');
    saveAnswers([
      makeAnswer({
        id: 'a1',
        questionId: 'q1',
        text: 'my answer body...',
        authorId: 'self',
        questionText: '오늘의 채용 미스매치 원인은?',
        type: '분석',
        date: '2026-04-28',
      }),
    ]);
    const list = document.createElement('div');
    list.id = 'archiveList';
    document.body.appendChild(list);

    const handlers = await import('../../src/ui/handlers/archive');
    handlers.rerenderList();

    const q = document.querySelector('.archive-card--answer .archive-card-question');
    expect(q?.textContent).toContain('오늘의 채용 미스매치 원인은?');
    expect(q?.classList.contains('archive-card-question--missing')).toBe(false);
  });

  it('renders muted "질문 정보 없음" when questionText absent (legacy)', async () => {
    const { saveAnswers } = await import('../../src/state/persistence');
    const { makeAnswer } = await import('../../src/state/schema');
    saveAnswers([
      makeAnswer({
        id: 'a2',
        questionId: 'q2',
        text: 'old answer',
        authorId: 'self',
        type: '분석',
        date: '2026-04-28',
      }),
    ]);
    const list = document.createElement('div');
    list.id = 'archiveList';
    document.body.appendChild(list);

    const handlers = await import('../../src/ui/handlers/archive');
    handlers.rerenderList();

    const q = document.querySelector('.archive-card--answer .archive-card-question--missing');
    expect(q?.textContent).toContain('질문 정보 없음');
  });

  it('renders type chip with toKoType label', async () => {
    const { saveAnswers } = await import('../../src/state/persistence');
    const { makeAnswer } = await import('../../src/state/schema');
    saveAnswers([
      makeAnswer({
        id: 'a3',
        questionId: 'q3',
        text: 't',
        authorId: 'self',
        type: '분석',
        date: '2026-04-28',
      }),
    ]);
    const list = document.createElement('div');
    list.id = 'archiveList';
    document.body.appendChild(list);

    const handlers = await import('../../src/ui/handlers/archive');
    handlers.rerenderList();

    const chip = document.querySelector('.archive-card--answer .archive-type-chip');
    expect(chip?.textContent).toMatch(/분석/);
  });

  it('answer body uses CSS line-clamp class (no JS truncation)', async () => {
    const longText = 'a'.repeat(500);
    const { saveAnswers } = await import('../../src/state/persistence');
    const { makeAnswer } = await import('../../src/state/schema');
    saveAnswers([
      makeAnswer({
        id: 'a4',
        questionId: 'q4',
        text: longText,
        authorId: 'self',
        questionText: 'q',
        type: '분석',
        date: '2026-04-28',
      }),
    ]);
    const list = document.createElement('div');
    list.id = 'archiveList';
    document.body.appendChild(list);

    const handlers = await import('../../src/ui/handlers/archive');
    handlers.rerenderList();

    const body = document.querySelector('.archive-card--answer .archive-card-body');
    // 풀 텍스트가 DOM에 들어 있어야 — CSS clamp가 시각만 자르도록
    expect(body?.textContent?.length).toBe(500);
  });

  it('answer card retains data-answer-id + delete button (aria-label "답변 삭제")', async () => {
    const { saveAnswers } = await import('../../src/state/persistence');
    const { makeAnswer } = await import('../../src/state/schema');
    saveAnswers([
      makeAnswer({
        id: 'a-keep',
        questionId: 'q',
        text: 't',
        authorId: 'self',
        questionText: 'q',
        type: '분석',
        date: '2026-04-28',
      }),
    ]);
    const list = document.createElement('div');
    list.id = 'archiveList';
    document.body.appendChild(list);

    const handlers = await import('../../src/ui/handlers/archive');
    handlers.rerenderList();

    const card = document.querySelector<HTMLElement>('.archive-card--answer');
    expect(card?.dataset['answerId']).toBe('a-keep');
    expect(card?.querySelector('.archive-card-delete')?.getAttribute('aria-label')).toBe('답변 삭제');
  });
});
