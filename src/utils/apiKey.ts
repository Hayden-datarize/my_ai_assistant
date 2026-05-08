// v3.23: handlers/home.ts 로컬 상수·함수를 격상. LS key는 P1-2에서 확인된 'dg_gemini_key'.
export const API_KEY_STORAGE = 'dg_gemini_key';

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) ?? '';
}
