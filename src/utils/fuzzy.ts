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

/**
 * v3.38 T5a (C4): Levenshtein distance — 표준 DP O(NM).
 * NFC normalize는 caller 의무 (`fuzzyMatchesToken` 등 wrapper에서 정규화).
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  let curr: number[] = Array.from({ length: n + 1 }, () => 0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const ai = a[i - 1];
    for (let j = 1; j <= n; j++) {
      const cost = ai === b[j - 1] ? 0 : 1;
      const insert = (curr[j - 1] ?? 0) + 1;
      const del = (prev[j] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(insert, del, sub);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n] ?? 0;
}

/**
 * v3.38 T5a (C4): fuzzy token matching with adaptive threshold.
 *
 * - token length ≤ 2: exact substring only (distance 0).
 * - token length 3-4: distance ≤ 1.
 * - token length ≥ 5: distance ≤ 2.
 *
 * 검색 token이 text의 부분 문자열에 fuzzy match되면 true.
 * sliding window로 text를 훑으며 token.length ± 1 윈도우의 최소 distance ≤ threshold 여부.
 *
 * **Codex P1-4 흡수**:
 * - per-record cap: text.length × token.length > 100_000 이면 exact substring fallback only (UI freeze 차단).
 * - 초성 token (`isInitialOnlyToken`) 은 fuzzy skip — 기존 matchesAllTokens initial 매칭이 처리.
 * - archive-wide guard (pool.length > 5000)는 T5b caller에서 적용.
 * - banded early-exit는 P3 carry (v3.39+).
 */
export function fuzzyMatchesToken(text: string, rawToken: string): boolean {
  const t = text.normalize('NFC').toLowerCase();
  const k = rawToken.normalize('NFC').toLowerCase();

  if (k.length === 0) return true;
  if (t.includes(k)) return true;
  if (k.length <= 2) return false;

  // 초성 token은 fuzzy 대상 외 — matchesAllTokens가 initial 매칭으로 처리.
  if (isInitialOnlyToken(k)) return false;

  // per-record cap
  if (t.length * k.length > 100_000) {
    return false;
  }

  const threshold = k.length <= 4 ? 1 : 2;
  const baseWin = k.length;

  // sliding window: 정확 길이 + ±1 (insertion/deletion fuzzy)
  for (let delta = -1; delta <= 1; delta++) {
    const w = baseWin + delta;
    if (w < 1) continue;
    for (let i = 0; i + w <= t.length; i++) {
      const sub = t.slice(i, i + w);
      if (levenshteinDistance(sub, k) <= threshold) return true;
    }
  }

  return false;
}
