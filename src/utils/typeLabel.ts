const TYPE_KO: Record<string, string> = {
  reflection: '성찰',
  action: '실행',
  observation: '관찰',
  planning: '계획',
};

export function toKoType(t: string | undefined): string {
  if (!t) return '기타';
  return TYPE_KO[t] ?? t;
}
