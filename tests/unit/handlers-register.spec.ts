import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const archiveSpies = vi.hoisted(() => ({
  mountArchiveHandlers: vi.fn(),
  hydrateArchive: vi.fn(),
  handleArchiveFilter: vi.fn(),
  handleArchiveSearch: vi.fn(),
  // v3.41 T6 (Codex P1 F6): handleArchivePeriodChange mock 제거 (dead control).
  handleArchiveUpdated: vi.fn(),
  handleInsightsChanged: vi.fn(),
}));

const statsSpies = vi.hoisted(() => ({
  hydrateStats: vi.fn(),
  handleStatsWeeklyReport: vi.fn(),
  handleStatsGrowthAnalysis: vi.fn(),
}));

const missionsSpies = vi.hoisted(() => ({
  hydrateMissions: vi.fn(),
}));

vi.mock('../../src/ui/handlers/archive', () => archiveSpies);
vi.mock('../../src/ui/handlers/stats', () => statsSpies);
// v3.50 T1 (C3): handlers/missions.ts 폐기 — missions-listeners가 직접 home.hydrateMissions 호출.
// home.ts는 다른 export가 다수이므로 importActual 병합 후 hydrateMissions만 spy 대체.
vi.mock('../../src/ui/handlers/home', async () => ({
  ...(await vi.importActual<typeof import('../../src/ui/handlers/home')>('../../src/ui/handlers/home')),
  hydrateMissions: missionsSpies.hydrateMissions,
}));

describe('registerCoreHandlerListeners (v3.31 C7)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(async () => {
    try {
      const mod = await import('../../src/ui/handlers/register');
      mod.resetCoreHandlerListenersForTest();
    } catch {
      // RED phase: module does not exist yet.
    }
  });

  it('registers archive nav listener once and lazy-calls archive mount + hydrate', async () => {
    const { registerCoreHandlerListeners } = await import('../../src/ui/handlers/register');
    registerCoreHandlerListeners();
    registerCoreHandlerListeners();

    document.dispatchEvent(new CustomEvent('dg:nav:tab-changed', { detail: { tab: 'archive' } }));

    await vi.waitFor(() => expect(archiveSpies.mountArchiveHandlers).toHaveBeenCalledTimes(1));
    expect(archiveSpies.hydrateArchive).toHaveBeenCalledTimes(1);
  });

  it('registers archive filter listener without duplicate handling', async () => {
    const { registerCoreHandlerListeners } = await import('../../src/ui/handlers/register');
    registerCoreHandlerListeners();
    registerCoreHandlerListeners();

    document.dispatchEvent(new CustomEvent('dg:archive:filter', { detail: { filter: '분석' } }));

    await vi.waitFor(() => {
      expect(archiveSpies.handleArchiveFilter).toHaveBeenCalledTimes(1);
    });
    expect(archiveSpies.handleArchiveFilter).toHaveBeenCalledWith('분석');
  });

  it('registers archive search/update/insight listeners lazily', async () => {
    const { registerCoreHandlerListeners } = await import('../../src/ui/handlers/register');
    registerCoreHandlerListeners();

    document.dispatchEvent(new CustomEvent('dg:archive:search'));
    await vi.waitFor(() => expect(archiveSpies.handleArchiveSearch).toHaveBeenCalledTimes(1));

    document.dispatchEvent(new CustomEvent('dg:archive:updated', { detail: { entity: 'answer', id: 'a1' } }));
    await vi.waitFor(() => expect(archiveSpies.handleArchiveUpdated).toHaveBeenCalledTimes(1));

    document.dispatchEvent(new CustomEvent('dg:insights:added', { detail: { id: 'i1' } }));
    await vi.waitFor(() => expect(archiveSpies.handleInsightsChanged).toHaveBeenCalledTimes(1));
  });

  it('registers stats nav/listener callbacks lazily', async () => {
    const { registerCoreHandlerListeners } = await import('../../src/ui/handlers/register');
    registerCoreHandlerListeners();

    document.dispatchEvent(new CustomEvent('dg:nav:tab-changed', { detail: { tab: 'stats' } }));
    await vi.waitFor(() => expect(statsSpies.hydrateStats).toHaveBeenCalledTimes(1));

    document.dispatchEvent(new CustomEvent('dg:stats:weekly-report'));
    await vi.waitFor(() => expect(statsSpies.handleStatsWeeklyReport).toHaveBeenCalledTimes(1));

    document.dispatchEvent(new CustomEvent('dg:stats:growth-analysis'));
    await vi.waitFor(() => expect(statsSpies.handleStatsGrowthAnalysis).toHaveBeenCalledTimes(1));
  });

  it('registers missions nav listener lazily', async () => {
    const { registerCoreHandlerListeners } = await import('../../src/ui/handlers/register');
    registerCoreHandlerListeners();

    document.dispatchEvent(new CustomEvent('dg:nav:tab-changed', { detail: { tab: 'missions' } }));

    await vi.waitFor(() => expect(missionsSpies.hydrateMissions).toHaveBeenCalledTimes(1));
  });
});
