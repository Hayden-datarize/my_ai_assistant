import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function setupDOM(): void {
  document.body.replaceChildren();
  const root = document.createElement('div');
  root.id = 'modalRoot';
  document.body.appendChild(root);

  const greeting = document.createElement('div');
  greeting.id = 'greetingText';
  document.body.appendChild(greeting);

  const streak = document.createElement('span');
  streak.id = 'streakCount';
  streak.textContent = '0';
  document.body.appendChild(streak);

  const xp = document.createElement('span');
  xp.id = 'xpBadge';
  xp.textContent = '0 XP';
  document.body.appendChild(xp);
}

function seedUser(overrides: Partial<{ streak: number; lastActiveDate: string; xp: number; level: number }>): void {
  const user = {
    name: 'H',
    interests: ['ai_ml'],
    onboardedAt: '2026-04-15',
    streak: overrides.streak ?? 0,
    lastActiveDate: overrides.lastActiveDate ?? '',
    xp: overrides.xp ?? 0,
    level: overrides.level ?? 1,
  };
  localStorage.setItem('user', JSON.stringify(user));
}

describe('submitAnswer 통합 — streak 전이', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    setupDOM();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Day 1 첫 답변: lastActiveDate="" → streak 0 → 1, xp 0 → 10', async () => {
    vi.setSystemTime(new Date('2026-04-19'));
    seedUser({ streak: 0, lastActiveDate: '', xp: 0 });

    const { applyAnswerActivity, hydrateGreetingAndStreak } = await import('../../src/ui/handlers/home');
    applyAnswerActivity();
    hydrateGreetingAndStreak();

    expect(document.getElementById('streakCount')?.textContent).toBe('1');
    expect(document.getElementById('xpBadge')?.textContent).toBe('10 XP');
    const persisted = JSON.parse(localStorage.getItem('user')!);
    expect(persisted.lastActiveDate).toBe('2026-04-19');
  });

  it('Day 2 연속 답변: streak 1 → 2, xp 10 + base(10) + mission bonus(있을 수 있음)', async () => {
    vi.setSystemTime(new Date('2026-04-20'));
    seedUser({ streak: 1, lastActiveDate: '2026-04-19', xp: 10 });

    const { applyAnswerActivity, hydrateGreetingAndStreak } = await import('../../src/ui/handlers/home');
    applyAnswerActivity();
    hydrateGreetingAndStreak();

    expect(document.getElementById('streakCount')?.textContent).toBe('2');
    // v3.13 mission wiring: answer action이 daily mission을 즉시 완수하면 +rewardXp 가산될 수 있음
    const xpText = document.getElementById('xpBadge')?.textContent ?? '';
    const xp = parseInt(xpText, 10);
    expect(xp).toBeGreaterThanOrEqual(20);  // base +10 최소, mission bonus 가산 가능
  });

  it('Day 4 끊긴 후 답변: streak 2 → 1 (gap reset)', async () => {
    vi.setSystemTime(new Date('2026-04-22'));
    seedUser({ streak: 2, lastActiveDate: '2026-04-20', xp: 20 });

    const { applyAnswerActivity, hydrateGreetingAndStreak } = await import('../../src/ui/handlers/home');
    applyAnswerActivity();
    hydrateGreetingAndStreak();

    expect(document.getElementById('streakCount')?.textContent).toBe('1');
    expect(document.getElementById('xpBadge')?.textContent).toBe('30 XP');
    const persisted = JSON.parse(localStorage.getItem('user')!);
    expect(persisted.lastActiveDate).toBe('2026-04-22');
  });

  it('같은 날 재제출: streak idempotent, xp 누적', async () => {
    vi.setSystemTime(new Date('2026-04-19'));
    seedUser({ streak: 5, lastActiveDate: '2026-04-19', xp: 20 });

    const { applyAnswerActivity, hydrateGreetingAndStreak } = await import('../../src/ui/handlers/home');
    applyAnswerActivity();
    applyAnswerActivity();
    hydrateGreetingAndStreak();

    expect(document.getElementById('streakCount')?.textContent).toBe('5');
    expect(document.getElementById('xpBadge')?.textContent).toBe('40 XP');
  });
});
