import type { MissionDef } from './missionTypes';

export const DAILY_POOL: readonly MissionDef[] = [
  { id: 'daily-answer-1', text: '오늘 답변 1개 작성', period: 'daily', target: 1, rewardXp: 10, triggerOn: 'answer' },
  { id: 'daily-scrap-1', text: '오늘 카드 1개 스크랩', period: 'daily', target: 1, rewardXp: 10, triggerOn: 'scrap' },
  { id: 'daily-memo-1', text: '오늘 답변에 메모 1줄 추가', period: 'daily', target: 1, rewardXp: 10, triggerOn: 'memo' },
  { id: 'daily-briefing-5', text: '오늘 카드뉴스 5장 끝까지 보기', period: 'daily', target: 5, rewardXp: 10, triggerOn: 'briefing-view' },
  { id: 'daily-cross-interest-1', text: '오늘 평소 안 보는 분야 카드 1개 보기', period: 'daily', target: 1, rewardXp: 10, triggerOn: 'cross-interest-view' },
  { id: 'daily-archive-revisit-1', text: '어제 답변 다시 열어보기', period: 'daily', target: 1, rewardXp: 10, triggerOn: 'archive-revisit' },
  { id: 'daily-answer-2', text: '오늘 답변 2개 (조금 어려움)', period: 'daily', target: 2, rewardXp: 10, triggerOn: 'answer' },
];

export const WEEKLY_FIXED: readonly MissionDef[] = [
  { id: 'weekly-answers-5', text: '이번 주 답변 5개', period: 'weekly', target: 5, rewardXp: 50, triggerOn: 'answer' },
  { id: 'weekly-active-5days', text: '이번 주 5일 이상 활동', period: 'weekly', target: 5, rewardXp: 50, triggerOn: 'active-day' },
];

export const MONTHLY_FIXED: readonly MissionDef[] = [
  { id: 'monthly-answers-20', text: '이번 달 답변 20개', period: 'monthly', target: 20, rewardXp: 200, triggerOn: 'answer' },
];

export const MISSION_CATALOG: readonly MissionDef[] = [
  ...DAILY_POOL, ...WEEKLY_FIXED, ...MONTHLY_FIXED,
];

const byId: Record<string, MissionDef> = Object.fromEntries(MISSION_CATALOG.map(d => [d.id, d]));

export function getMissionDef(id: string): MissionDef | undefined {
  return byId[id];
}
