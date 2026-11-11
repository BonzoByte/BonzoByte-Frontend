/** One countdown per notice; reading pauses the remaining time, not a fresh duration. */
export class NoticeCountdown {
  private remaining: number;
  private timer?: ReturnType<typeof setTimeout>;
  private startedAt = 0;
  private started = false;
  private disposed = false;
  private pauses = new Set<string>();
  private persistent: boolean;

  constructor(durationMs: number, private elapsed: () => void) {
    this.remaining = Math.min(Math.max(0, durationMs), 2 ** 31 - 1);
    this.persistent = durationMs <= 0;
  }

  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    this.schedule();
  }

  pause(reason: string): void {
    if (this.disposed) return;
    this.pauses.add(reason);
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.remaining = Math.max(0, this.remaining - (Date.now() - this.startedAt));
    }
  }

  resume(reason: string): void {
    if (!this.pauses.delete(reason)) return;
    this.schedule();
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.pauses.clear();
  }

  private schedule(): void {
    if (!this.started || this.disposed || this.pauses.size || this.timer !== undefined) return;
    // A zero initial duration is an intentionally persistent notice.
    if (this.persistent) return;
    this.startedAt = Date.now();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.disposed = true;
      this.elapsed();
    }, this.remaining);
  }
}
