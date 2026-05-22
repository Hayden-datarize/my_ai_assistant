/**
 * v3.49 — Mission 완수 sparkle micro-animation 트리거 (event-based queue).
 *
 * 기존 `dg:reward:mission-complete` 이벤트(achievements.ts emit, false→true 전환 +
 * 새 instance 즉시 완수 모두 catch)를 listen해 sparkle queue에 defId를 push한다.
 * `renderMissionsSection`이 mount 직후 `consumeSparkleQueue()`로 소비하고 카드에 class 부착.
 *
 * Reload 안전: 페이지 reload 후 queue 비어있음 → persisted completed 미션은 sparkle 발화 X.
 * (render diff 패턴은 reload 시 false-positive 발화 위험이 있어 폐기됨.)
 */
import { on } from './events';

let sparkleQueue: Set<string> = new Set();
let listenerWired = false;
let unsubscribe: (() => void) | null = null;

export function mountMissionsSparkleListener(): void {
  if (listenerWired) return;
  unsubscribe = on('dg:reward:mission-complete', ({ defId }) => {
    sparkleQueue.add(defId);
  });
  listenerWired = true;
}

export function consumeSparkleQueue(): Set<string> {
  const out = sparkleQueue;
  sparkleQueue = new Set();
  return out;
}

export function isReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** @internal — 테스트에서 queue + listenerWired + document listener 초기화. */
export function __resetSparkleState(): void {
  sparkleQueue = new Set();
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  listenerWired = false;
}
