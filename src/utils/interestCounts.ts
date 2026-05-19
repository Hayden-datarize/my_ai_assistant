import { loadAnswers } from '../state/persistence';
import { loadBriefings, type Briefing } from '../state/briefings';
import { INTERESTS } from './categories';
import { matchesInterest } from './interestKeywords';
import type { Answer } from '../state/schema';

/**
 * v3.39 T6 (Codex P1-3): archive entityMatchesInterest와 동일 predicate.
 *
 * 매칭 우선순위:
 *   1. a.interestId === id  (T2 이후 신규 entity의 자연 경로 — exact)
 *   2. a.interestId === 'unknown' (legacy)  →  matchesInterest(text+questionText, id) fallback
 *   3. 외 → false
 *
 * 정합 의무 (Codex P1-3): archive UI count + plant-detail 카운터 + stats byInterest 모두
 * "T6 이후 path"는 동일 predicate를 따라야 silent drift 차단.
 */
function answerMatchesInterest(a: Answer, id: string): boolean {
  if (a.interestId === id) return true;
  if (a.interestId === 'unknown') {
    const text = `${a.text ?? ''} ${a.questionText ?? ''}`;
    return matchesInterest(text, id);
  }
  return false;
}

function briefingMatchesInterest(b: Briefing, id: string): boolean {
  if (b.interestId === id) return true;
  if (b.interestId === 'unknown') {
    const text = `${b.title} ${b.summary} ${b.memo}`;
    return matchesInterest(text, id);
  }
  return false;
}

/**
 * 분야별 답변 count.
 *
 * v3.39 T6 (Codex P1-3): exact match (a.interestId) + 'unknown' legacy fallback (matchesInterest).
 * v3.22 T3 (P2-3): catalog 외 interestId는 즉시 0 — id가 텍스트와 우연 매칭되는 edge case 차단.
 */
export function getAnswerCountByInterest(interestId: string): number {
  if (!INTERESTS.some(i => i.id === interestId)) return 0;
  return loadAnswers().filter(a => answerMatchesInterest(a, interestId)).length;
}

/**
 * 분야별 스크랩 count (b.scrapped === true 만).
 *
 * v3.39 T6 (Codex P1-3): exact match (b.interestId) + 'unknown' legacy fallback.
 * v3.22 T3 (P2-3): catalog 외 interestId는 즉시 0 — id 우연 매칭 차단.
 */
export function getScrapCountByInterest(interestId: string): number {
  if (!INTERESTS.some(i => i.id === interestId)) return 0;
  return loadBriefings().filter(b => b.scrapped && briefingMatchesInterest(b, interestId)).length;
}
