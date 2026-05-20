type InterestCategory = 'HR' | 'Tech' | 'Biz' | 'General';

export interface Interest {
  id: string;
  label: string;      // includes emoji prefix (legacy format)
  category: InterestCategory;
}

export const INTERESTS: readonly Interest[] = [
  { id: 'recruiting', label: '🎯 채용', category: 'HR' },
  { id: 'onboarding', label: '🚀 온보딩', category: 'HR' },
  { id: 'culture', label: '🏢 조직문화', category: 'HR' },
  { id: 'hr_system', label: '📋 인사제도', category: 'HR' },
  { id: 'labor_law', label: '⚖️ 노무/법률', category: 'HR' },
  { id: 'leadership', label: '👑 리더십', category: 'HR' },
  { id: 'pm', label: '📱 프로덕트', category: 'Tech' },
  { id: 'ai_ml', label: '🤖 AI/ML', category: 'Tech' },
  { id: 'data', label: '📊 데이터분석', category: 'Tech' },
  { id: 'startup', label: '🦄 스타트업', category: 'Biz' },
  { id: 'marketing', label: '📣 마케팅', category: 'Biz' },
  { id: 'productivity', label: '⚡ 생산성', category: 'General' },
  { id: 'career', label: '🎯 커리어', category: 'General' },
  { id: 'communication', label: '💬 커뮤니케이션', category: 'General' },
  { id: 'self_dev', label: '🌱 자기계발', category: 'General' },
] as const;

const LABEL_MAP = new Map(INTERESTS.map(i => [i.id, i.label] as const));

export function getCategoryLabel(interestId: string): string {
  return LABEL_MAP.get(interestId) ?? '📰 일반';
}
