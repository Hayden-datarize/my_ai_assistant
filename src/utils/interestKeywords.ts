import { INTERESTS } from './categories';

/**
 * interest ID(snake_case)를 RSS 텍스트에 매칭 가능한 keyword 배열로 확장.
 * v3.14 T2: achievements.ts 내부에서 추출 — home·achievements 양쪽 재사용.
 */
export function interestKeywords(id: string): string[] {
  const meta = INTERESTS.find(c => c.id === id);
  if (!meta) return [id.toLowerCase()];
  const label = meta.label.replace(/^\p{Extended_Pictographic}+\s*/u, '').toLowerCase();
  return [id.toLowerCase(), ...label.split(/[\s/]+/).filter(Boolean)];
}
