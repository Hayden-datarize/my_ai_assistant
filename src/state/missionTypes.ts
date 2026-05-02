export type MissionPeriod = 'daily' | 'weekly' | 'monthly';

export type MissionAction =
  | 'answer'
  | 'scrap'
  | 'memo'
  | 'briefing-view'
  | 'cross-interest-view'
  | 'archive-revisit'
  | 'active-day';

export interface MissionDef {
  id: string;
  text: string;
  period: MissionPeriod;
  target: number;
  rewardXp: number;
  triggerOn: MissionAction;
  badgeTrigger?: string;
}

export interface MissionInstance {
  defId: string;
  period: MissionPeriod;
  windowStart: number;
  progress: number;
  completed: boolean;
  progressDates?: readonly string[];
}
