/**
 * v3.32 T1: archive 검색용 fuzzy helper.
 *
 * - 다중 토큰 AND (whitespace split)
 * - 한글 초성 매칭 (음절 → 19자 자음 compatibility jamo)
 * - 외부 라이브러리 미사용, bundle 친화 단순 ASCII regex.
 *
 * 정규화 순서: NFC → toLowerCase → trim → split (NFC 먼저 — NFD 입력 lowercase 회피).
 */

const HANGUL_INITIAL_CONSONANTS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const HANGUL_SYLLABLE_START = 0xac00;
const HANGUL_SYLLABLE_END = 0xd7a3;
const INITIAL_ONLY_RE = /^[ㄱ-ㅎ]+$/;

export function tokenizeQuery(raw: string): string[] {
  return raw
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

export function getInitialConsonants(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code >= HANGUL_SYLLABLE_START && code <= HANGUL_SYLLABLE_END) {
      const idx = Math.floor((code - HANGUL_SYLLABLE_START) / 588);
      out += HANGUL_INITIAL_CONSONANTS[idx];
    } else {
      out += ch;
    }
  }
  return out;
}

export function isInitialOnlyToken(t: string): boolean {
  return INITIAL_ONLY_RE.test(t);
}

export function matchesAllTokens(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  // v3.32 T7 fix-A (Codex 최종 P2-1): token도 NFC + lowercase 정규화.
  // 프로덕션은 tokenizeQuery 거쳐 idempotent하지만, exported helper 단독 호출
  // (matchesAllTokens('Hello', ['Hello']))도 안전하게 매칭.
  const normalized = text.normalize('NFC').toLowerCase();
  const initials = getInitialConsonants(normalized);
  return tokens.every((rawToken) => {
    const token = rawToken.normalize('NFC').toLowerCase();
    return isInitialOnlyToken(token) ? initials.includes(token) : normalized.includes(token);
  });
}
