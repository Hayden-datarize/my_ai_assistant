import type { Snapshot } from './gameTypes';

export interface BadgeDef {
  id: string;
  icon: string;
  name: string;
  description: string;
  category: 'streak' | 'volume' | 'tier' | 'diversity' | 'engagement';
  predicate: (snap: Snapshot) => boolean;
}

export const BADGE_CATALOG: readonly BadgeDef[] = [
  // Streak (5)
  { id: 'streak-3',   icon: '🔥', name: '첫 불씨',     description: '연속 3일 답변',   category: 'streak', predicate: s => s.streak >= 3 },
  { id: 'streak-7',   icon: '🔥', name: '주간 스트릭',  description: '연속 7일 답변',   category: 'streak', predicate: s => s.streak >= 7 },
  { id: 'streak-30',  icon: '🌟', name: '한 달 스트릭', description: '연속 30일 답변',  category: 'streak', predicate: s => s.streak >= 30 },
  { id: 'streak-100', icon: '💯', name: '백일 스트릭',  description: '연속 100일 답변', category: 'streak', predicate: s => s.streak >= 100 },
  { id: 'streak-365', icon: '👑', name: '일년 스트릭',  description: '연속 365일 답변', category: 'streak', predicate: s => s.streak >= 365 },

  // Volume (4)
  { id: 'answers-1',   icon: '🌱', name: '첫 답변',    description: '누적 답변 1개',   category: 'volume', predicate: s => s.answersCount >= 1 },
  { id: 'answers-10',  icon: '📚', name: '열 걸음',    description: '누적 답변 10개',  category: 'volume', predicate: s => s.answersCount >= 10 },
  { id: 'answers-30',  icon: '🎯', name: '한 달 완성', description: '누적 답변 30개',  category: 'volume', predicate: s => s.answersCount >= 30 },
  { id: 'answers-100', icon: '💎', name: '백문백답',   description: '누적 답변 100개', category: 'volume', predicate: s => s.answersCount >= 100 },

  // Tier (3) — xp boundary 와 1:1
  { id: 'tier-3-tree',     icon: '🌳', name: '나무', description: '레벨 3 도달 (XP 300)',  category: 'tier', predicate: s => s.xp >= 300 },
  { id: 'tier-5-mountain', icon: '🏔️', name: '산',   description: '레벨 5 도달 (XP 1000)', category: 'tier', predicate: s => s.xp >= 1000 },
  { id: 'tier-6-sky',      icon: '🌌', name: '하늘', description: '레벨 6 MAX 도달 (XP 2000)', category: 'tier', predicate: s => s.xp >= 2000 },

  // Diversity (3)
  { id: 'diversity-types',         icon: '🎨', name: '다재다능',   description: '5가지 질문 유형 중 4종 이상 답변 (분석/전환/실무/성장/트렌드)',
    category: 'diversity',
    predicate: s => {
      // P0 fix: 실제 home.ts:657-661은 한국어 라벨 5종을 사용. 영문 키는 dead badge였음.
      const KO_TYPES = ['분석', '전환', '실무', '성장', '트렌드'];
      return KO_TYPES.filter(t => s.uniqueAnsweredTypes.has(t)).length >= 4;
    } },
  { id: 'diversity-interests-all', icon: '🌍', name: '만물박사',   description: '선택한 모든 관심분야에 스크랩 1건 이상',
    category: 'diversity',
    predicate: s => s.selectedInterests.size > 0 &&
      Array.from(s.selectedInterests).every(i => s.engagedInterests.has(i)) },
  { id: 'diversity-scrap-cats',    icon: '📖', name: '호기심',     description: '스크랩한 브리핑의 unique 카테고리 8개 이상',
    category: 'diversity',
    predicate: s => s.uniqueScrapCategories >= 8 },

  // Engagement (3)
  { id: 'scrap-1',  icon: '📌', name: '첫 스크랩', description: '누적 스크랩 1개',  category: 'engagement', predicate: s => s.scrapsCount >= 1 },
  { id: 'scrap-50', icon: '📰', name: '정보왕',    description: '누적 스크랩 50개', category: 'engagement', predicate: s => s.scrapsCount >= 50 },
  { id: 'memo-5',   icon: '✏️', name: '메모왕',    description: '누적 메모 5개',    category: 'engagement', predicate: s => s.memosCount >= 5 },
] as const;

export function findBadge(id: string): BadgeDef | undefined {
  return BADGE_CATALOG.find(b => b.id === id);
}
