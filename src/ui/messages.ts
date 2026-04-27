/**
 * i18n Lite — 사용자 가시 toast/dialog 텍스트의 단일 진입점.
 *
 * 어조 규칙 (위반 시 lint 또는 PR review에서 catch):
 * - 캐주얼 `~했어요` 톤 (정중체 `~했습니다` 금지, 명사형 `~됨` 금지)
 * - 마침표는 모든 메시지(toast 포함) 끝에 사용
 * - 이모지는 success(✅) / info(ℹ️) / error(❌) 3종만, 그 외 emoji 금지
 *
 * v3.6에서 빈도 ≥2 규칙을 폐기 — 사용자 가시 메시지는 빈도 무관 모두 통합.
 * Full i18n (`t('key')` 시스템 + 다국어 카탈로그)은 v3.7+ 별 사이클로,
 * 본 모듈은 그때까지 staging 역할.
 */
export const MSG = {
  TRY_AGAIN: '잠시 후 다시 시도해 주세요.',
  SAVE_SUCCESS: '저장되었어요.',
  AI_RESPONSE_FAIL: '지금은 AI 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.',
  DEMO_API_KEY_PROMPT: 'AI 응답을 받으려면 API 키를 등록해 주세요.',
  INTERESTS_UPDATED: '관심 분야가 업데이트되었어요.',
  ANSWER_SAVED: '답변이 저장되었어요.',
  SAVE_FAILED: '❌ 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
  SAVE_QUOTA_EXCEEDED: '❌ 저장 공간이 가득 찼어요. 설정에서 번역 캐시를 초기화해 주세요.',
  partialTranslateFail: (count: number): string =>
    `일부 카드 번역에 실패했어요 (${count}건). 잠시 후 다시 시도해 주세요.`,
  DELETE_CONFIRM_BULK: (n: number) =>
    `선택한 답변 ${n}개를 삭제할까요?\n5초 안에 되돌릴 수 있어요.`,
  DELETE_CONFIRM_ALL: (n: number) =>
    `archive 답변 ${n}개를 모두 삭제할까요?\n5초 안에 되돌릴 수 있어요.`,
  DELETE_UNDO_TOAST: '삭제되었어요.',
  DELETE_UNDO_ACTION: '되돌리기',
  DELETE_UNDO_RESTORED: '복원되었어요.',
  DELETE_UNDO_FAILED: '복원 실패했어요.',
  SCRAP_UNDO_TOAST: '스크랩을 해제했어요.',
  SCRAP_UNDO_RESTORED: '스크랩을 복원했어요.',
  SCRAP_BULK_CONFIRM: (n: number) =>
    `선택한 스크랩 ${n}개를 해제할까요?\n5초 안에 되돌릴 수 있어요.`,
  SCRAP_BULK_UNDO_TOAST: (n: number) => `${n}개 스크랩을 해제했어요.`,
} as const;
