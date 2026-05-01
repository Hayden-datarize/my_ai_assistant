import { INTERESTS } from './categories';

/**
 * interest ID(snake_case)를 RSS 텍스트에 매칭 가능한 keyword 배열로 확장.
 * v3.14 T2: achievements.ts 내부에서 추출 — home·achievements 양쪽 재사용.
 */
export function interestKeywords(id: string): string[] {
  const meta = INTERESTS.find(c => c.id === id);
  if (!meta) return [id.toLowerCase()];
  const label = meta.label.replace(/^\p{Extended_Pictographic}+\s*/u, '').toLowerCase();
  return [id.toLowerCase(), ...label.split(/[\s/]+/).filter(Boolean)];
}

/**
 * v3.14 T13 (codex P1): cross-interest 매칭 헬퍼 — 짧은 ASCII 토큰(`ai`, `ml` 등)이
 * 무관 영단어 부분 문자열(`daily`, `retail` 등)에 매칭되는 false-positive를 차단하기 위한
 * word-boundary 매칭. 한국어/긴 토큰은 기존 substring includes 유지.
 *
 * 호출 측은 hay를 `.toLowerCase()`로 정규화한 상태로 넘긴다 (interestKeywords도 lowercase 출력).
 *
 * 예: `matchKeyword('daily training session', 'ai')` → false (false-positive 차단)
 *     `matchKeyword('ai 동향 정리', 'ai')` → true (word-boundary 양쪽 모두 만족)
 *     `matchKeyword('ai_ml etf 시장', 'ai_ml')` → true (length>3 → includes)
 *     `matchKeyword('인사제도 개편', '인사제도')` → true (non-ASCII → includes)
 *
 * v3.14.1 T1: home.ts에서 utils로 격상 — achievements.ts(state)에서도 재사용.
 */
// v3.14.1 P2: keyword별 RegExp 캐시 — takeSnapshot이 ~1500 호출/사용자액션 환경에서 누적 perf 절감
const SHORT_RE_CACHE = new Map<string, RegExp>();

export function matchKeyword(hay: string, keyword: string): boolean {
  if (keyword.length <= 3 && /^[a-z0-9_]+$/.test(keyword)) {
    let re = SHORT_RE_CACHE.get(keyword);
    if (!re) {
      re = new RegExp(`\\b${keyword}\\b`);
      SHORT_RE_CACHE.set(keyword, re);
    }
    return re.test(hay);
  }
  return hay.includes(keyword);
}
