import { on } from '../events';

function warn(context: string, err: unknown): void {
  console.warn(`[stats-listeners] ${context} failed`, err);
}

export function registerStatsListeners(): () => void {
  const off = [
    on('dg:stats:weekly-report', () => {
      void import('./stats')
        .then((m) => m.handleStatsWeeklyReport())
        .catch((err) => warn('weekly-report', err));
    }),
    on('dg:stats:growth-analysis', () => {
      void import('./stats')
        .then((m) => m.handleStatsGrowthAnalysis())
        .catch((err) => warn('growth-analysis', err));
    }),
    on('dg:nav:tab-changed', ({ tab }) => {
      if (tab !== 'stats') return;
      void import('./stats')
        .then((m) => m.hydrateStats())
        .catch((err) => warn('tab-changed', err));
    }),
  ];

  return () => {
    for (let i = off.length - 1; i >= 0; i--) off[i]?.();
  };
}
