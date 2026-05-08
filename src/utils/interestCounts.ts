import { loadAnswers } from '../state/persistence';
import { loadBriefings } from '../state/briefings';
import { interestKeywords, matchKeyword } from './interestKeywords';

/**
 * 분야별 답변 count.
 * Answer.interest 필드 없음 (사전 review T0 grep 검증) — interestKeywords + matchKeyword
 * 패턴 사용 (briefing scrap 매칭과 동일, tickPlantsByBriefingInMemory 패턴 차용).
 * 사용자 정의 분야 (catalog 외)는 keywords = [id.toLowerCase()] fallback 반환되므로,
 * 답변 텍스트에 id 자체가 포함되지 않으면 count 0. id가 텍스트와 우연 매칭되는 edge case는
 * v3.22+ INTERESTS.find guard 추가 검토 (T6 review N1 carry).
 */
export function getAnswerCountByInterest(interestId: string): number {
  const keywords = interestKeywords(interestId);
  if (keywords.length === 0) return 0;
  return loadAnswers().filter(a => {
    const hay = ((a.text ?? '') + ' ' + (a.questionText ?? '')).toLowerCase();
    return keywords.some(k => matchKeyword(hay, k));
  }).length;
}

/**
 * 분야별 스크랩 count (b.scrapped === true 만).
 * 사용자 정의 분야 (catalog 외)는 keywords = [id.toLowerCase()] fallback 반환되므로,
 * 브리핑 텍스트에 id 자체가 포함되지 않으면 count 0. v3.22+ INTERESTS.find guard 검토 (T6 N1).
 */
export function getScrapCountByInterest(interestId: string): number {
  const keywords = interestKeywords(interestId);
  if (keywords.length === 0) return 0;
  return loadBriefings().filter(b => {
    if (!b.scrapped) return false;
    const hay = ((b.title ?? '') + ' ' + (b.summary ?? '')).toLowerCase();
    return keywords.some(k => matchKeyword(hay, k));
  }).length;
}
