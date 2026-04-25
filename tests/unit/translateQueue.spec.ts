import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranslateQueue } from '../../src/ui/translateQueue';

describe('TranslateQueue', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('limits concurrency to 3', async () => {
    const inFlightSnapshots: number[] = [];
    let active = 0;
    const work = async (id: string): Promise<string> => {
      active++;
      inFlightSnapshots.push(active);
      await new Promise<void>((r) => setTimeout(r, 100));
      active--;
      return 'ko-' + id;
    };
    const q = new TranslateQueue(work, { concurrency: 3, delayMs: 0 });
    for (let i = 0; i < 6; i++) q.enqueue('id-' + i);
    await vi.advanceTimersByTimeAsync(50);
    expect(Math.max(...inFlightSnapshots)).toBeLessThanOrEqual(3);
    await vi.advanceTimersByTimeAsync(500);
  });

  it('skips duplicate ids while in-flight', async () => {
    const calls: string[] = [];
    const work = async (id: string): Promise<string> => {
      calls.push(id);
      await new Promise<void>((r) => setTimeout(r, 50));
      return 'ko';
    };
    const q = new TranslateQueue(work, { concurrency: 1, delayMs: 0 });
    q.enqueue('a'); q.enqueue('a'); q.enqueue('a');
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toEqual(['a']);
  });

  it('inserts delayMs between dispatches', async () => {
    const dispatchedAt: number[] = [];
    const start = Date.now();
    const work = async (): Promise<string> => {
      dispatchedAt.push(Date.now() - start);
      return 'ko';
    };
    const q = new TranslateQueue(work, { concurrency: 1, delayMs: 200 });
    q.enqueue('a'); q.enqueue('b'); q.enqueue('c');
    await vi.advanceTimersByTimeAsync(700);
    const t0 = dispatchedAt[0] ?? 0;
    const t1 = dispatchedAt[1] ?? 0;
    expect(t1 - t0).toBeGreaterThanOrEqual(200);
  });

  it('continues queue after a failed task', async () => {
    const calls: string[] = [];
    const work = async (id: string): Promise<string> => {
      calls.push(id);
      if (id === 'fail') throw new Error('boom');
      return 'ko-' + id;
    };
    const q = new TranslateQueue(work, { concurrency: 1, delayMs: 0 });
    q.enqueue('fail'); q.enqueue('ok');
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toEqual(['fail', 'ok']);
  });
});
