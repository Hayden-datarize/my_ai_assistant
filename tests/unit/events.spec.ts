import { describe, it, expect, vi } from 'vitest';
import { dispatch, on, EVENT_NAMES, V32_DEFERRED_EVENTS } from '../../src/ui/events';

describe('events', () => {
  it('dispatches a typed event with detail and invokes the matching listener', () => {
    const handler = vi.fn();
    const off = on('dg:archive:filter', handler);
    dispatch('dg:archive:filter', { filter: 'reflection' });
    expect(handler).toHaveBeenCalledWith({ filter: 'reflection' });
    off();
  });

  it('supports undefined-detail events', () => {
    const handler = vi.fn();
    const off = on('dg:home:refresh-briefings', handler);
    dispatch('dg:home:refresh-briefings', undefined);
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it('off() removes the listener', () => {
    const handler = vi.fn();
    const off = on('dg:home:refresh-briefings', handler);
    off();
    dispatch('dg:home:refresh-briefings', undefined);
    expect(handler).not.toHaveBeenCalled();
  });

  it('listens on `document` (matches existing v3.0 tab dispatchers)', () => {
    const handler = vi.fn();
    const off = on('dg:home:toggle-theme', handler);
    document.dispatchEvent(new CustomEvent('dg:home:toggle-theme'));
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it('EVENT_NAMES covers all 25 wired events (24 baseline + v3.23 T8: insights:added)', () => {
    // v3.21 T5: +1 reward event (`dg:reward:streak-freeze-used` — caller-side direct dispatch)
    // v3.23 T8: +1 insights event (`dg:insights:added`). `:removed`는 T9에서 추가.
    expect(EVENT_NAMES).toHaveLength(25);
    expect(new Set(EVENT_NAMES).size).toBe(25);
  });

  it('V32_DEFERRED_EVENTS lists the 2 잔존 stubs (v3.23 T8 graduated 4건 제거)', () => {
    // v3.23 T8: summarize-chat / generate-insight-card / weekly-report / growth-analysis 4건
    // 실구현 graduate. dismiss-backup / archive:period-change 2건만 잔존.
    expect(V32_DEFERRED_EVENTS).toHaveLength(2);
    for (const e of V32_DEFERRED_EVENTS) expect(EVENT_NAMES).toContain(e);
  });
});
