/**
 * v3.29 T2: archive 검색 keyword `<mark>` highlight helper.
 *
 * 보안 invariant (Codex 사전 P1-2 흡수):
 * - text는 escapeHtml로 모두 sanitize
 * - query는 escapeRegex로 리터럴 매칭 (regex injection 차단)
 * - `<mark>` span만 raw HTML — 외부 입력 전체가 escape 후 mark만 inject
 * - NFC normalize → case-insensitive (archive.ts:380 precedent 재사용)
 */

import { escapeHtml } from './escapeHtml';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightHtml(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const q = query.normalize('NFC');
  const t = text.normalize('NFC');
  const re = new RegExp(escapeRegex(q), 'gi');
  if (!re.test(t)) return escapeHtml(text);

  // re-run with capture (test() advances lastIndex)
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
