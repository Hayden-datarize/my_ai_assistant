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

describe('TranslateQueue partial-failure summary', () => {
  beforeEach(() => { vi.useRealTimers(); });

  it('invokes onDrain with failedCount > 0 when any work threw', async () => {
    const onDrain = vi.fn();
    const queue = new TranslateQueue(
      async (id: string) => { if (id === 'fail') throw new Error('boom'); return id; },
      { concurrency: 2, delayMs: 0, onDrain },
    );
    queue.enqueue('ok1');
    queue.enqueue('fail');
    queue.enqueue('ok2');
    await new Promise((r) => setTimeout(r, 50)); // allow drain
    expect(onDrain).toHaveBeenCalledTimes(1);
    expect(onDrain).toHaveBeenCalledWith({ failedCount: 1 });
  });

  it('does not invoke onDrain when no failures (silent success)', async () => {
    const onDrain = vi.fn();
    const queue = new TranslateQueue(
      async (id: string) => id,
      { concurrency: 2, delayMs: 0, onDrain },
    );
    queue.enqueue('a');
    queue.enqueue('b');
    await new Promise((r) => setTimeout(r, 50));
    // onDrain은 항상 호출되지만 failedCount=0이면 호출자가 spam 안 함.
    // 정책: onDrain은 실패 1건+에서만 호출 (caller 단순화)
    expect(onDrain).not.toHaveBeenCalled();
  });
});
