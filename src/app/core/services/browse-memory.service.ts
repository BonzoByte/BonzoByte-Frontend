import { Injectable } from '@angular/core';

interface ScrollPoint { top: number; left: number; }
export interface BrowseScroll {
  window: ScrollPoint;
  main: ScrollPoint | null;
  regions: Record<string, ScrollPoint[]>;
}
export interface BrowseVisit<T> { state: T; scroll: BrowseScroll; }

const REGIONS = ['.table-wrapper', '.tournament-groups-scroll',
  '.match-table-scroll:not(.match-table-scroll--grouped)', '.date-left'] as const;
const point = (node: Element): ScrollPoint => ({ top: node.scrollTop, left: node.scrollLeft });
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Small view descriptions only: no archives, account data or browser-storage writes. */
@Injectable({ providedIn: 'root' })
export class BrowseMemoryService {
  private readonly visits = new Map<string, BrowseVisit<unknown>>();

  remember<T>(key: string, state: T, host: HTMLElement): void {
    const visit = this.capture(state, host);
    if (!visit) return;
    this.visits.delete(key);
    this.visits.set(key, visit);
    while (this.visits.size > 24) this.visits.delete(this.visits.keys().next().value!);
  }

  /** Capture a transient view without adding it to navigation history. */
  capture<T>(state: T, host: HTMLElement): BrowseVisit<T> | null {
    const serialized = JSON.stringify(state);
    if (serialized.length > 16384) return null;
    const view = host.ownerDocument.defaultView;
    const main = host.closest('.main-content');
    const scroll: BrowseScroll = {
      window: { top: view?.scrollY ?? 0, left: view?.scrollX ?? 0 },
      main: main ? point(main) : null,
      regions: Object.fromEntries(REGIONS.map(selector => [selector,
        Array.from(host.querySelectorAll(selector)).slice(0, 8).map(point)]))
    };
    return { state: JSON.parse(serialized), scroll };
  }

  recall<T>(key: string): BrowseVisit<T> | null {
    const visit = this.visits.get(key);
    return visit ? copy(visit) as BrowseVisit<T> : null;
  }

  /** Restore only after Angular has rendered the loaded rows; stop if the user intervenes. */
  restore(host: HTMLElement, scroll: BrowseScroll, done: () => void = () => {}): () => void {
    const view = host.ownerDocument.defaultView;
    if (!view) return () => {};
    let frame = 0, active = true;
    const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const cancel = () => {
      if (!active) return;
      active = false;
      view.cancelAnimationFrame(frame);
      for (const event of inputs) host.ownerDocument.removeEventListener(event, cancel, true);
    };
    for (const event of inputs) host.ownerDocument.addEventListener(event, cancel, { capture: true, passive: true });
    frame = view.requestAnimationFrame(() => {
      frame = view.requestAnimationFrame(() => {
        if (!active || !host.isConnected) { cancel(); return; }
        for (const selector of REGIONS) {
          const nodes = host.querySelectorAll(selector);
          (scroll.regions[selector] ?? []).forEach((saved, index) => {
            const node = nodes[index];
            if (node) { node.scrollTop = saved.top; node.scrollLeft = saved.left; }
          });
        }
        const main = host.closest('.main-content');
        if (main && scroll.main) { main.scrollTop = scroll.main.top; main.scrollLeft = scroll.main.left; }
        // An instant call also cancels an in-flight smooth scroll from applying the filter.
        view.scrollTo({ top: scroll.window.top, left: scroll.window.left, behavior: 'instant' });
        cancel();
        done();
      });
    });
    return cancel;
  }
}

export function rememberedArchiveDay(saved: string | undefined, days: string[], fallback: string): string {
  if (!saved || !/^\d{4}-\d{2}-\d{2}$/.test(saved) || !days.length) return fallback;
  if (days.includes(saved)) return saved;
  // A removed archive day resolves to the closest earlier available day, or the first day.
  return [...days].reverse().find(day => day < saved) ?? days[0];
}
