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

export function mountMissionsSparkleListener(): () => void {
  if (listenerWired) {
    // 두 번째 mount는 no-op cleanup 반환 — 첫 mount의 listener는 그대로.
    return () => { /* no-op */ };
  }

  // local disposer capture — module-level 참조 회피 (Codex P1-4).
  const disposer = on('dg:reward:mission-complete', ({ defId }) => {
    sparkleQueue.add(defId);
  });
  listenerWired = true;
  // module-level `unsubscribe`는 __resetSparkleState()용으로 유지.
  unsubscribe = disposer;

  let cleaned = false;
  return () => {
    if (cleaned) return;       // double cleanup safety
    cleaned = true;
    // 본 closure가 capture한 disposer만 호출 — 다른 mount의 listener는 안 건드림.
    disposer();
    // 본 cleanup이 첫 mount의 것이면 module flag도 reset (재 mount 가능).
    if (unsubscribe === disposer) {
      unsubscribe = null;
      listenerWired = false;
    }
  };
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
