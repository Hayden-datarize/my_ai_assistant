import { on } from '../events';

function warn(context: string, err: unknown): void {
  console.warn(`[archive-listeners] ${context} failed`, err);
}

export function registerArchiveListeners(): () => void {
  const off = [
    on('dg:archive:filter', ({ filter }) => {
      void import('./archive')
        .then((m) => m.handleArchiveFilter(filter))
        .catch((err) => warn('filter', err));
    }),
    on('dg:archive:search', () => {
      void import('./archive')
        .then((m) => m.handleArchiveSearch())
        .catch((err) => warn('search', err));
    }),
    // v3.41 T6 (Codex P1 F6): period-change listener 제거 (dead control).
    on('dg:archive:updated', () => {
      void import('./archive')
        .then((m) => m.handleArchiveUpdated())
        .catch((err) => warn('updated', err));
    }),
    on('dg:insights:added', () => {
      void import('./archive')
        .then((m) => m.handleInsightsChanged())
        .catch((err) => warn('insights-added', err));
    }),
    on('dg:insights:removed', () => {
      void import('./archive')
        .then((m) => m.handleInsightsChanged())
        .catch((err) => warn('insights-removed', err));
    }),
    on('dg:insights:updated', () => {
      void import('./archive')
        .then((m) => m.handleInsightsChanged())
        .catch((err) => warn('insights-updated', err));
    }),
    on('dg:nav:tab-changed', ({ tab }) => {
      if (tab !== 'archive') return;
      void import('./archive')
        .then((m) => {
          m.mountArchiveHandlers();
          m.hydrateArchive();
        })
        .catch((err) => warn('tab-changed', err));
    }),
  ];

  return () => {
    for (let i = off.length - 1; i >= 0; i--) off[i]?.();
  };
}
