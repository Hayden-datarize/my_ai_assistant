import { describe, it, expect, vi, beforeEach } from 'vitest';

// v3.41 T1 (Codex P0 F1): Firebase App Check 모듈 mock — 실제 firebase init이
// vitest jsdom 환경에서 fetch mock을 잠식하는 회귀 차단. token 발급은 단위
// 테스트 책임 X (functions/__tests__에서 별도 검증 예정 Phase B).
vi.mock('../../../src/services/appCheck', () => ({
  getAppCheckToken: vi.fn().mockResolvedValue(null),
}));

import { sendAnswerDm, autoSendAnswer } from '../../../src/services/slack';
import { saveSlackSettings, clearSlackSettings } from '../../../src/state/slack';

global.fetch = vi.fn();

describe('sendAnswerDm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    saveSlackSettings({ email: 'me@datarize.ai', autoSend: true });
  });

  it('POSTs to /api/sendAnswerDm with email + answer payload', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    await sendAnswerDm({ question: 'Q?', answer: 'A.' });
    expect(fetch).toHaveBeenCalledWith('/api/sendAnswerDm', expect.objectContaining({
      method: 'POST',
    }));
    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body);
    expect(callBody.email).toBe('me@datarize.ai');
    expect(callBody.answer).toBe('A.');
  });

  it('wraps streak/xp from loadUserData (P0-2 fix)', async () => {
    // production read key는 'user' (src/state/user.ts:36)
    localStorage.setItem('user', JSON.stringify({
      name: 'T', onboardedAt: '2026-04-01', interests: ['tech'],
      streak: 5, lastActiveDate: '', xp: 120, earnedBadges: {},
      gamificationMigrated: true, gardenIntroduced: true, schemaVersion: 2,
    }));
    saveSlackSettings({ email: 'me@datarize.ai', autoSend: true });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    await sendAnswerDm({ question: 'Q?', answer: 'A.' });
    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body);
    expect(callBody.streak).toBe(5);
    expect(callBody.xp).toBe(120);
  });

  it('defaults streak/xp to 0 when user data absent', async () => {
    saveSlackSettings({ email: 'me@datarize.ai', autoSend: true });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    await sendAnswerDm({ question: 'Q?', answer: 'A.' });
    const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body);
    expect(callBody.streak).toBe(0);
    expect(callBody.xp).toBe(0);
  });

  it('throws when email settings missing', async () => {
    clearSlackSettings();
    await expect(sendAnswerDm({ question: 'Q?', answer: 'A.' })).rejects.toThrow();
  });

  it('classifies 429 as rate_limited', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: 'rate_limited' }) });
    await expect(sendAnswerDm({ question: 'Q?', answer: 'A.' })).rejects.toThrow(/rate/);
  });
});

describe('autoSendAnswer', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

  it('skips when autoSend=false', async () => {
    saveSlackSettings({ email: 'me@datarize.ai', autoSend: false });
    await autoSendAnswer({ question: 'Q?', answer: 'A.' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('calls fetch when autoSend=true', async () => {
    saveSlackSettings({ email: 'me@datarize.ai', autoSend: true });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    await autoSendAnswer({ question: 'Q?', answer: 'A.' });
    expect(fetch).toHaveBeenCalled();
  });

  it('swallows errors silently in autoSendAnswer', async () => {
    saveSlackSettings({ email: 'me@datarize.ai', autoSend: true });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: 'dm_open_failed' }) });
    await expect(autoSendAnswer({ question: 'Q?', answer: 'A.' })).resolves.toBeUndefined();
  });
});
