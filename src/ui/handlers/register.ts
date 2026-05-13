import { registerArchiveListeners } from './archive-listeners';
import { registerStatsListeners } from './stats-listeners';
import { registerMissionsListeners } from './missions-listeners';

let registered = false;
let cleanup: (() => void) | null = null;

export function registerCoreHandlerListeners(): void {
  if (registered) return;

  const disposers = [
    registerArchiveListeners(),
    registerStatsListeners(),
    registerMissionsListeners(),
  ];
  cleanup = () => {
    for (let i = disposers.length - 1; i >= 0; i--) {
      disposers[i]?.();
    }
  };
  registered = true;
}

/** @internal test-only: remove listeners registered by registerCoreHandlerListeners. */
export function resetCoreHandlerListenersForTest(): void {
  cleanup?.();
  cleanup = null;
  registered = false;
}
