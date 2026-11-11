import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, NgZone, OnDestroy } from '@angular/core';

/** Tracks draft presence only. It never stores text, persists data or replays writes. */
@Injectable({ providedIn: 'root' })
export class DraftUnloadGuardService implements OnDestroy {
  private readonly readers = new Map<object, () => boolean>();
  private readonly view: Window | null;
  private listening = false;
  private destroyed = false;

  constructor(@Inject(DOCUMENT) document: Document, private zone: NgZone) {
    this.view = document.defaultView;
  }

  register(hasDraft: () => boolean): () => void {
    if (this.destroyed) return () => {};
    const token = {};
    this.readers.set(token, hasDraft);
    this.refresh();
    return () => { this.readers.delete(token); this.refresh(); };
  }

  hasPendingDrafts(): boolean {
    if (this.destroyed) return false;
    for (const read of this.readers.values()) if (read()) return true;
    return false;
  }

  refresh(): void {
    if (this.destroyed || !this.view) return;
    const pending = this.hasPendingDrafts();
    if (pending === this.listening) return;
    this.listening = pending;
    this.zone.runOutsideAngular(() => {
      if (pending) this.view!.addEventListener('beforeunload', this.beforeUnload);
      else this.view!.removeEventListener('beforeunload', this.beforeUnload);
    });
  }

  private readonly beforeUnload = (event: BeforeUnloadEvent): void => {
    // Recheck actual current state; cancelling navigation never changes a draft.
    if (!this.hasPendingDrafts()) return;
    event.preventDefault();
    event.returnValue = '';
  };

  ngOnDestroy(): void {
    this.destroyed = true;
    this.readers.clear();
    if (this.listening) this.view?.removeEventListener('beforeunload', this.beforeUnload);
    this.listening = false;
  }
}
