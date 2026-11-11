import { Injectable, signal } from '@angular/core';

interface RecoverableRead { retry: () => void; failed: boolean; }

/** Only active views register explicit read-only reloads. Never stores/replays HTTP requests. */
@Injectable({ providedIn: 'root' })
export class ReadRecoveryService {
  private readonly reads = new Map<object, RecoverableRead>();
  private readonly failed = signal(false);
  private readonly episode = signal(0);
  readonly hasFailure = this.failed.asReadonly();
  readonly failureEpisode = this.episode.asReadonly();

  register(owner: object, retry: () => void): () => void {
    const entry = { retry, failed: false };
    this.reads.set(owner, entry);
    this.update();
    return () => { if (this.reads.get(owner) === entry) { this.reads.delete(owner); this.update(); } };
  }
  begin(owner: object): void {
    const entry = this.reads.get(owner);
    if (entry) { entry.failed = false; this.update(); }
  }
  unavailable(owner: object): void {
    const entry = this.reads.get(owner);
    if (!entry || entry.failed) return;
    entry.failed = true;
    this.episode.update(value => value + 1);
    this.update();
  }
  /** User action only. Clearing first prevents a double click from duplicating a read. */
  retry(): void {
    const pending = [...this.reads].filter(([, entry]) => entry.failed);
    for (const [, entry] of pending) entry.failed = false;
    this.update();
    for (const [owner, entry] of pending) {
      if (this.reads.get(owner) !== entry) continue;
      try { entry.retry(); } catch { this.unavailable(owner); }
    }
  }
  private update(): void { this.failed.set([...this.reads.values()].some(entry => entry.failed)); }
}
