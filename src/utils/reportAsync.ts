import { showToast } from './toast';

/**
 * Boot-time dynamic import 등 fire-and-forget Promise를 안전하게 추적.
 *
 * - reject → console.warn + showToast (toast mount 전이면 silently catch)
 * - resolve → return value 그대로 통과
 *
 * v3.40 L1 silent-fail lesson 차단용. `void import(...)` 패턴이 unhandled
 * rejection을 만들어 사용자에게 빈 화면만 남기는 사고 방지.
 */
export function reportAsync<T>(label: string, p: Promise<T>): Promise<T | undefined> {
  return p.catch((err: unknown) => {
    console.warn(`[reportAsync:${label}]`, err);
    try {
      showToast(`${label} 로드 실패 — 새로고침 해주세요`);
    } catch {
      // toast mount 전 boot race — silently absorb
    }
    return undefined;
  });
}
