import { describe, it, expect, vi } from 'vitest';
import { dispatch, on } from '../../src/ui/events';

describe('events', () => {
  it('dispatches a typed event and invokes the matching listener with detail', () => {
    const handler = vi.fn();
    const off = on('dg:home:submit-answer', handler);
    dispatch('dg:home:submit-answer', { text: 'hello' });
    expect(handler).toHaveBeenCalledWith({ text: 'hello' });
    off();
  });

  it('supports void-detail events', () => {
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
});
