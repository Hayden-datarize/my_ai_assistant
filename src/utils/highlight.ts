/**
 * v3.32 T2: archive 검색 keyword `<mark>` highlight helper (tokens 배열 signature).
 *
 * 보안 invariant (v3.29 P1-2 유지):
 * - text는 escapeHtml로 모두 sanitize
 * - 각 substring 토큰은 escapeRegex로 리터럴 매칭 (regex injection 차단)
 * - `<mark>` span만 raw HTML — 외부 입력 전체가 escape 후 mark만 inject
 * - NFC normalize → case-insensitive
 *
 * 토큰 정책:
 * - 초성-only 토큰 (`/^[ㄱ-ㅎ]+$/`)은 highlight skip (filter pass-only)
 * - substring 토큰은 길이 desc sort → alternation 단일 sweep regex (overlap 시 긴 토큰 우선)
 * - 빈 배열 또는 substring 토큰 0개 → escapeHtml(text)만 반환
 */

import { escapeHtml } from './escapeHtml';
import { isInitialOnlyToken } from './fuzzy';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightHtml(text: string, tokens: string[]): string {
  const substringTokens = tokens.filter((t) => t.length > 0 && !isInitialOnlyToken(t));
  if (substringTokens.length === 0) return escapeHtml(text);

  // 길이 desc sort — alternation에서 긴 토큰이 먼저 매칭 (overlap 시 longest-first)
  const sorted = [...substringTokens].sort((a, b) => b.length - a.length);
  const pattern = sorted.map((t) => escapeRegex(t.normalize('NFC'))).join('|');
  const re = new RegExp(pattern, 'gi');

  const t = text.normalize('NFC');
  if (!re.test(t)) return escapeHtml(text);

  re.lastIndex = 0;
  let out = '';
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    out += escapeHtml(t.slice(lastIdx, m.index));
    out += `<mark>${escapeHtml(m[0])}</mark>`;
    lastIdx = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++; // zero-width 방지
  }
  out += escapeHtml(t.slice(lastIdx));
  return out;
}
