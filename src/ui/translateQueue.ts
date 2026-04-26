/**
 * TranslateQueue — concurrency-limited background queue for title translations.
 *
 * - 동시에 최대 `concurrency`개의 작업만 실행
 * - 각 dispatch 사이에 `delayMs` 만큼의 최소 간격 유지
 * - 동일 id가 in-flight 중이거나 pending 중이면 중복 enqueue 무시
 * - 실패는 카운터에 누적; drain 완료 시 failedCount > 0이면 `onDrain` 호출
 *   (정책: 실패 1건+에서만 호출 — caller가 spam 방지 신경 쓸 필요 없음)
 */

type Worker = (id: string) => Promise<string>;

interface Options {
  concurrency: number;
  delayMs: number;
  onDrain?: (info: { failedCount: number }) => void;
}

export class TranslateQueue {
  private pending: string[] = [];
  private inFlight = new Set<string>();
  private active = 0;
  private lastDispatchAt = 0;
  private failedCount = 0;

  constructor(private work: Worker, private opts: Options) {}

  enqueue(id: string): void {
    if (this.inFlight.has(id) || this.pending.includes(id)) return;
    this.pending.push(id);
    this.process();
  }

  private process(): void {
    while (this.active < this.opts.concurrency && this.pending.length > 0) {
      const id = this.pending.shift();
      if (id === undefined) break;
      this.inFlight.add(id);
      this.active++;
      const now = Date.now();
      const wait = Math.max(0, this.opts.delayMs - (now - this.lastDispatchAt));
      this.lastDispatchAt = now + wait;
      setTimeout(() => { void this.run(id); }, wait);
    }
  }

  private async run(id: string): Promise<void> {
    try { await this.work(id); }
    catch { this.failedCount++; }
    finally {
      this.active--;
      this.inFlight.delete(id);
      this.process();
      // Drain detection: nothing in-flight, nothing pending.
      if (this.active === 0 && this.pending.length === 0) {
        const failed = this.failedCount;
        this.failedCount = 0; // reset for next batch
        if (failed > 0) {
          try { this.opts.onDrain?.({ failedCount: failed }); }
          catch { /* drain notifier failures must not break the queue */ }
        }
      }
    }
  }
}
