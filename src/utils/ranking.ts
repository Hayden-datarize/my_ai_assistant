/**
 * v3.34 T1: archive 검색 ranking helper.
 *
 * 알고리즘: score = Σ_token max(weight | token hits field)
 * - token이 모든 field에 hit 안 하면 → 0 기여 (AND filter 통과 entry는 도달 불가)
 * - field 여러 곳 hit해도 max(weight) 한 번만 인정 (binary, cap=1)
 * - substring / 초성-only 토큰 둘 다 동일 평가 (max(weight) binary)
 */
import { getInitialConsonants, isInitialOnlyToken } from './fuzzy';

export interface ScoredField {
  text: string;
  weight: number;
}

export function scoreEntry(fields: ScoredField[], tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const normalized = fields.map((f) => ({
    weight: f.weight,
    body: f.text.normalize('NFC').toLowerCase(),
    initials: getInitialConsonants(f.text.normalize('NFC').toLowerCase()),
  }));
  let total = 0;
  for (const rawToken of tokens) {
    const token = rawToken.normalize('NFC').toLowerCase();
    const isInitial = isInitialOnlyToken(token);
    let maxHitWeight = 0;
    for (const f of normalized) {
      const hit = isInitial ? f.initials.includes(token) : f.body.includes(token);
      if (hit && f.weight > maxHitWeight) maxHitWeight = f.weight;
    }
    total += maxHitWeight;
  }
  return total;
}
