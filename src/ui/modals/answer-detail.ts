/**
 * Read-only answer detail modal (v3.11 T7).
 *
 * Spec §4.8. Archive 답변 카드 클릭 시 (✕ 제외) 전체 질문 + 답변 + AI 평가를
 * 보여주는 read-only 모달. 편집/삭제/재평가 UI 없음 — 삭제는 카드 ✕ 버튼 경로 유지.
 *
 * Legacy 답변 (questionText 없음) 은 "질문 정보 없음 (이전 버전 답변)" placeholder
 * + archive-card-question--missing class 로 graceful degrade.
 *
 * 모달 셸 (focus trap / ESC / backdrop / × / a11y) 은 shared.openModal 가 처리.
 */

import { openModal } from './shared';
import { escapeHtml } from '../../utils/escapeHtml';
import type { Answer } from '../../state/schema';

export function openAnswerDetail(a: Answer): void {
  const parts: string[] = [];

  // Heading: 질문 본문 또는 legacy placeholder
  if (a.questionText) {
    parts.push(
      `<h3 class="answer-detail-question">${escapeHtml(a.questionText)}</h3>`
    );
  } else {
    parts.push(
      `<h3 class="answer-detail-question archive-card-question--missing">질문 정보 없음 (이전 버전 답변)</h3>`
    );
  }

  // Meta line: [type] date (둘 다 optional)
  const metaPieces: string[] = [];
  if (a.type) metaPieces.push(`[${escapeHtml(a.type)}]`);
  if (a.date) metaPieces.push(escapeHtml(a.date));
  if (metaPieces.length > 0) {
    parts.push(`<p class="answer-detail-meta">${metaPieces.join(' ')}</p>`);
  }

  // Body: full text — white-space: pre-wrap CSS 가 줄바꿈 보존
  parts.push(`<p class="answer-detail-body">${escapeHtml(a.text)}</p>`);

  // Evaluation feedback (있을 때만) — legacy parity: score + feedback
  if (a.evaluation?.feedback) {
    const score =
      typeof a.evaluation.score === 'number' ? `${a.evaluation.score}점 — ` : '';
    parts.push(
      `<p class="answer-detail-feedback">💡 AI 평가 ${score}${escapeHtml(a.evaluation.feedback)}</p>`
    );
  }

  openModal({
    title: '내 답변',
    bodyHtml: parts.join(''),
  });
}
