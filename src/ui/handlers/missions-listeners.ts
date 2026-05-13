import { on } from '../events';

export function registerMissionsListeners(): () => void {
  const off = [
    on('dg:nav:tab-changed', ({ tab }) => {
      if (tab !== 'missions') return;
      void import('./missions')
        .then((m) => m.handleMissionsTabChanged())
        .catch((err) => {
          console.warn('[missions-listeners] tab-changed failed', err);
        });
    }),
  ];

  return () => {
    for (let i = off.length - 1; i >= 0; i--) off[i]?.();
  };
}
