import { validateInsightText, validateInterestId } from '../state/user';
import { INTERESTS } from './categories';

export function parseJsonText<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('gemini response: no JSON object');
  // eslint-disable-next-line no-control-regex -- deliberately strip control chars from LLM output
  const cleaned = match[0].replace(/[\x00-\x1f]+/g, ' ').replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(cleaned) as T;
}

/**
 * v3.25 T3: 한국어/emoji label → id alias map (Codex P1-B1 fix).
 * Gemini가 instruction 무시하고 label 직접 반환 시 폴백.
 */
const INTEREST_LABEL_ALIAS = new Map<string, string>(
  INTERESTS.flatMap(i => [
    [i.label, i.id] as [string, string],                                                          // emoji prefix 포함 ('🎯 채용')
    [i.label.replace(/^[\p{Emoji}\p{Emoji_Component}\s]+/u, ''), i.id] as [string, string],       // emoji prefix 제거 ('채용'). Emoji_Component는 VS-16(U+FE0F)/ZWJ 등 포함 — '⚖️ 노무/법률'(labor_law) 케이스 fix (T3 review C1)
  ]),
);

/**
 * id 후처리: quote/prefix strip + alias map → whitelist 폴백.
 * @internal
 */
function normalizeInterestId(raw: string): string {
  const stripped = raw
    .trim()
    .replace(/^["'`]|["'`]$/g, '')                  // quote wrap
    .replace(/^(interestId|분야)\s*[:：]\s*/i, '')  // prefix label
    .trim();
  if (stripped.length === 0) return 'unknown';
  const aliased = INTEREST_LABEL_ALIAS.get(stripped);
  if (aliased) return aliased;
  return validateInterestId(stripped);
}

/**
 * v3.25 T3: Gemini insight 응답 `<text>|<interestId>` 견고 파싱.
 *
 * 폴백 chain (Codex P1-B1 강화):
 * 1. JSON wrap 감지 — fenced json 또는 raw {...} → text/interestId 추출 우선
 * 2. 첫 비빈 줄만 추출 (Gemini 여러 줄 응답 대비)
 * 3. markdown wrap 제거 (backtick / asterisk / dash)
 * 4. lastIndexOf('|') 기준 split (text에 '|' 포함 가능성 차단)
 * 5. id 후처리 — quote/prefix strip → alias map → validateInterestId 최종 폴백
 *
 * @throws Error text가 모든 폴백 후에도 빈 경우 (validateInsightText)
 */
export function parseInsightResponse(raw: string): { text: string; interestId: string } {
  // 1. JSON wrap 감지 (fenced json 또는 raw {...})
  const jsonMatch = raw.match(/\{[\s\S]*?"text"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      if (typeof obj.text === 'string' && obj.text.trim().length > 0) {
        return {
          text: validateInsightText(obj.text),
          interestId: typeof obj.interestId === 'string'
            ? normalizeInterestId(obj.interestId)
            : 'unknown',
        };
      }
    } catch { /* fall through to line-based parse */ }
  }

  // 2. 첫 비빈 줄만 추출
  const firstLine = raw
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length > 0) ?? '';

  // 3. markdown wrap 제거
  const stripped = firstLine
    .replace(/^[`*-]+|[`*-]+$/g, '')
    .trim();

  // 4. lastIndexOf('|') 기준 split
  const lastPipe = stripped.lastIndexOf('|');
  if (lastPipe === -1) {
    return {
      text: validateInsightText(stripped),
      interestId: 'unknown',
    };
  }

  const rawText = stripped.slice(0, lastPipe).trim();
  const rawId = stripped.slice(lastPipe + 1).trim();

  return {
    text: validateInsightText(rawText),
    interestId: normalizeInterestId(rawId),
  };
}

/**
 * v3.39 T3 (Codex 사전 P1-2): generateQuestion 응답 + cached/fallback path 공통 사용.
 *
 * Resolve 규칙:
 * - rawId가 INTERESTS whitelist 통과 → 그대로
 * - rawId invalid/empty/undefined → userInterests[0] 폴백
 * - userInterests=[] → 'unknown' sentinel
 *
 * deterministic / idempotent — 같은 input → 같은 output.
 */
export function resolveQuestionInterestId(
  rawId: string | undefined,
  userInterests: string[],
): string {
  if (!rawId) return userInterests[0] ?? 'unknown';
  const validated = validateInterestId(rawId);
  if (validated !== 'unknown') return validated;
  return userInterests[0] ?? 'unknown';
}

export interface QuestionResponse {
  type: string;
  question: string;
  hint: string;
  targetInterestId: string;
}

/**
 * v3.39 T3 (Codex 사전 P1-2): generateQuestion JSON 응답 parse + interestId validate fallback.
 *
 * 폴백 chain (parseInsightResponse 패턴 미러):
 * 1. JSON parse fail → throw (caller가 fallbackQuestion으로 catch)
 * 2. type/question/hint 누락 시 안전 default (빈 string / '분석')
 * 3. interestId 누락 또는 invalid → resolveQuestionInterestId 통과 (userInterests[0] 또는 'unknown')
 *
 * 보안: parseJsonText는 외부 Gemini 응답 — control char strip + trailing comma 정리 후
 * JSON.parse. 추출한 필드는 모두 `typeof === 'string'` guard 통과 후에만 채용.
 *
 * @internal Caller: home.ts hydrateQuestion (live path + cached path 공통).
 */
export function parseQuestionResponse(
  raw: string,
  userInterests: string[],
): QuestionResponse {
  const data = parseJsonText<{
    type?: unknown;
    question?: unknown;
    hint?: unknown;
    interestId?: unknown;
  }>(raw);
  const type = typeof data.type === 'string' ? data.type : '분석';
  const question = typeof data.question === 'string' ? data.question : '';
  const hint = typeof data.hint === 'string' ? data.hint : '';
  const rawId = typeof data.interestId === 'string' ? data.interestId : '';
  const targetInterestId = resolveQuestionInterestId(rawId, userInterests);
  return { type, question, hint, targetInterestId };
}
