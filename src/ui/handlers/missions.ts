/**
 * Missions tab handler.
 *
 * v3.14 T4: 홈에서 missions 영역이 분리됨에 따라 nav가 missions 탭으로 전환될 때
 * 별도로 hydrate 해야 한다. hydrateMissions() 자체는 home.ts에 이미 export
 * 되어 있어 재사용 (one-way import: missions.ts → home.ts).
 *
 * codex P1-6 (cycle check): home.ts는 본 모듈을 import 하지 않으므로 순환 없음.
 * main.ts가 양쪽을 각각 register 한다.
 */

import { on } from '../events';
import { hydrateMissions } from './home';

export function registerMissionsHandlers(): void {
  on('dg:nav:tab-changed', ({ tab }) => {
    if (tab === 'missions') {
      hydrateMissions();
    }
  });
}
