import { on } from '../events';
import { mountMissionsSparkleListener } from '../missions-sparkle';

export function registerMissionsListeners(): () => void {
  // v3.49 T5 Codex 최종 P1: sparkle queue listener는 boot 시점부터 활성이어야 한다.
  // 홈/다른 탭에서 답변 제출 시 mission-complete가 즉시 발생하고, 그 시점에 missions
  // 탭은 mount 전이므로 queue에 미리 push해뒀다가 첫 진입 render에서 소비 — sparkle 발화.
  // v3.50 T2 C2: cleanup symmetry — sparkle detach도 off에 포함.
  const cleanupSparkle = mountMissionsSparkleListener();

  const off = [
    on('dg:nav:tab-changed', ({ tab }) => {
      if (tab !== 'missions') return;
      // v3.50 T1 C3 rewire: handlers/missions.ts dead path 제거 → home.hydrateMissions().
      void import('./home')
        .then((m) => m.hydrateMissions())
        .catch((err) => {
          console.warn('[missions-listeners] tab-changed failed', err);
        });
    }),
    cleanupSparkle,
  ];

  return () => {
    for (let i = off.length - 1; i >= 0; i--) off[i]?.();
  };
}
