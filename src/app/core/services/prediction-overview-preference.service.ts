import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const ENABLED_STORAGE_KEY = 'bonzobyte.predictionOverview.enabled';
const HIDDEN_UNTIL_STORAGE_KEY = 'bonzobyte.predictionOverview.hiddenUntil';
const DEFAULT_SNOOZE_DAYS = 30;

@Injectable({ providedIn: 'root' })
export class PredictionOverviewPreferenceService {
  private readonly visibleSubject = new BehaviorSubject<boolean>(this.readVisibility());

  readonly visible$ = this.visibleSubject.asObservable();

  get isVisible(): boolean {
    return this.visibleSubject.value;
  }

  dismissForDays(days = DEFAULT_SNOOZE_DAYS): void {
    const safeDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_SNOOZE_DAYS;
    const hiddenUntil = Date.now() + safeDays * 24 * 60 * 60 * 1000;

    this.writeStorage(HIDDEN_UNTIL_STORAGE_KEY, String(hiddenUntil));
    this.visibleSubject.next(false);
  }

  setVisible(visible: boolean): void {
    this.writeStorage(ENABLED_STORAGE_KEY, String(visible));

    if (visible) {
      this.removeStorage(HIDDEN_UNTIL_STORAGE_KEY);
    }

    this.visibleSubject.next(visible);
  }

  private readVisibility(): boolean {
    try {
      if (typeof localStorage === 'undefined') return true;

      if (localStorage.getItem(ENABLED_STORAGE_KEY) === 'false') return false;

      const hiddenUntil = Number(localStorage.getItem(HIDDEN_UNTIL_STORAGE_KEY));
      if (Number.isFinite(hiddenUntil) && hiddenUntil > Date.now()) return false;

      if (hiddenUntil) localStorage.removeItem(HIDDEN_UNTIL_STORAGE_KEY);
    } catch {
      // The overview remains visible when browser storage is unavailable.
    }

    return true;
  }

  private writeStorage(key: string, value: string): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch {
      // The in-memory preference still applies for the current page.
    }
  }

  private removeStorage(key: string): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch {
      // The in-memory preference still applies for the current page.
    }
  }
}
