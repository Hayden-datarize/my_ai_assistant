/**
 * TranslateQueue — concurrency-limited background queue for title translations.
 *
 * - 동시에 최대 `concurrency`개의 작업만 실행
 * - 각 dispatch 사이에 `delayMs` 만큼의 최소 간격 유지
 * - 동일 id가 in-flight 중이거나 pending 중이면 중복 enqueue 무시
 * - 실패는 조용히 무시 (Task 11에서 toast 처리 예정)
 */

type Worker = (id: string) => Promise<string>;

interface Options { concurrency: number; delayMs: number; }

export class TranslateQueue {
  private pending: string[] = [];
  private inFlight = new Set<string>();
  private active = 0;
  private lastDispatchAt = 0;

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
    catch { /* 실패 무시 — Task 11에서 toast 처리 */ }
    finally {
      this.active--;
      this.inFlight.delete(id);
      this.process();
    }
  }
}
