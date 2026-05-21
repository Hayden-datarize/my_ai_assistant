import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as slackModule from '../slack';
import * as rateLimitModule from '../rateLimit';

// verifyToken 제어용 mock ref — 각 test에서 교체 가능
const mockVerifyToken = vi.fn().mockResolvedValue({ token: 'mock-app-check-token' });

vi.mock('../slack');
vi.mock('../rateLimit');
vi.mock('firebase-admin/app-check', () => ({
  getAppCheck: () => ({ verifyToken: mockVerifyToken }),
}));
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
}));

import { _handleSendAnswerDm } from '../sendAnswerDm';

function makeReq(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const defaultHeaders: Record<string, string> = { 'x-firebase-appcheck': 'valid-token-mock', ...headers };
  const req: { method: string; body: Record<string, unknown>; header: (name: string) => string | undefined } = {
    method: 'POST',
    body,
    header: (name: string) => defaultHeaders[name.toLowerCase()],
  };
  return req;
}

function makeRes() {
  const res: any = {
    statusCode: 0,
    body: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
  return res;
}

const mockTokenGetter = () => 'mock-slack-token';
const baseBody = { email: 'test@datarize.ai', question: 'Q', answer: 'A', streak: 1, xp: 100 };

describe('sendAnswerDm Phase B contract — App Check verify + 정보 누출 차단', () => {
  beforeEach(() => {
    vi.mocked(rateLimitModule.checkRateLimit).mockReturnValue('ok');
    vi.mocked(slackModule.buildAnswerBlocks).mockReturnValue([] as any);
    // 기본값: verifyToken 성공
    mockVerifyToken.mockResolvedValue({ token: 'mock-app-check-token' });
  });

  it('App Check token 미존재 → 401 app_check_required', async () => {
    const req = makeReq(baseBody);
    req.header = () => undefined;
    const res = makeRes();
    await _handleSendAnswerDm(req, res, mockTokenGetter);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'app_check_required' });
  });

  it('req.body null → 400 invalid_body (App Check 통과 후 가드)', async () => {
    const req = makeReq(baseBody);
    (req as { body: unknown }).body = null;
    const res = makeRes();
    await _handleSendAnswerDm(req, res, mockTokenGetter);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_body' });
  });

  it('App Check token invalid → 401 app_check_invalid', async () => {
    mockVerifyToken.mockRejectedValueOnce(new Error('bad token'));
    const req = makeReq(baseBody);
    const res = makeRes();
    await _handleSendAnswerDm(req, res, mockTokenGetter);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'app_check_invalid' });
  });

  it('user_not_found → 202 generic {ok:true} (enumeration 차단)', async () => {
    vi.mocked(slackModule.sendDmAsBot).mockRejectedValue(new Error('user_not_found'));
    const res = makeRes();
    await _handleSendAnswerDm(makeReq(baseBody), res, mockTokenGetter);
    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({ ok: true });
  });

  it('lookup_failed → 202 generic {ok:true}', async () => {
    vi.mocked(slackModule.sendDmAsBot).mockRejectedValue(new Error('lookup_failed'));
    const res = makeRes();
    await _handleSendAnswerDm(makeReq(baseBody), res, mockTokenGetter);
    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({ ok: true });
  });

  it('dm_open_failed → 202 generic {ok:true}', async () => {
    vi.mocked(slackModule.sendDmAsBot).mockRejectedValue(new Error('dm_open_failed'));
    const res = makeRes();
    await _handleSendAnswerDm(makeReq(baseBody), res, mockTokenGetter);
    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({ ok: true });
  });

  it('post_message_failed → 502 (회귀 가드, enumeration 불가)', async () => {
    vi.mocked(slackModule.sendDmAsBot).mockRejectedValue(new Error('post_message_failed'));
    const res = makeRes();
    await _handleSendAnswerDm(makeReq(baseBody), res, mockTokenGetter);
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'post_message_failed' });
  });
});
