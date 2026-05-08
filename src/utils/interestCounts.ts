import { loadAnswers } from '../state/persistence';
import { loadBriefings } from '../state/briefings';
import { interestKeywords, matchKeyword } from './interestKeywords';

/**
 * 분야별 답변 count.
 * Answer.interest 필드 없음 (사전 review T0 grep 검증) — interestKeywords + matchKeyword
 * 패턴 사용 (briefing scrap 매칭과 동일, tickPlantsByBriefingInMemory 패턴 차용).
 * 사용자 정의 분야 (interestKeywords 빈 배열) → count 0 (자연 동작).
 */
export function getAnswerCountByInterest(interestId: string): number {
  const keywords = interestKeywords(interestId);
  if (keywords.length === 0) return 0;
  return loadAnswers().filter(a => {
    const hay = ((a.text ?? '') + ' ' + (a.questionText ?? '')).toLowerCase();
    return keywords.some(k => matchKeyword(hay, k));
  }).length;
}

/** 분야별 스크랩 count (b.scrapped === true 만). */
export function getScrapCountByInterest(interestId: string): number {
  const keywords = interestKeywords(interestId);
  if (keywords.length === 0) return 0;
  return loadBriefings().filter(b => {
    if (!b.scrapped) return false;
    const hay = ((b.title ?? '') + ' ' + (b.summary ?? '')).toLowerCase();
    return keywords.some(k => matchKeyword(hay, k));
  }).length;
}
