import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// v3.20 T4 (A4): cors whitelist (옵션 B).
// production 도메인 한정 — same-origin rewrite와 정합 + 의도치 않은 cross-origin 차단.
// cors: true (모든 origin 허용)에서 격상.

const sendAnswerDmSource = readFileSync(
  resolve(__dirname, '../sendAnswerDm.ts'),
  'utf-8',
);

describe('v3.20 T4: sendAnswerDm cors whitelist', () => {
  it('does not use cors: true (모든 origin 허용 회귀 가드)', () => {
    expect(sendAnswerDmSource).not.toMatch(/cors:\s*true/);
  });

  it('uses CORS_ORIGINS array (whitelist)', () => {
    expect(sendAnswerDmSource).toMatch(/cors:\s*CORS_ORIGINS/);
  });

  it('whitelist includes production .web.app domain', () => {
    expect(sendAnswerDmSource).toMatch(
      /['"]https:\/\/my-ai-assistant-904f3\.web\.app['"]/,
    );
  });

  it('whitelist includes production .firebaseapp.com domain', () => {
    expect(sendAnswerDmSource).toMatch(
      /['"]https:\/\/my-ai-assistant-904f3\.firebaseapp\.com['"]/,
    );
  });

  it('comment references same-origin rewrite alignment', () => {
    expect(sendAnswerDmSource).toMatch(/same-origin rewrite/i);
  });
});
