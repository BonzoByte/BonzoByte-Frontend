import { Injectable, signal } from '@angular/core';

export const HISTORICAL_PL_NOTICE_STORAGE_KEY = 'bonzobyte.historicalPlNotice.visible.v1';

/** Browser-local explanatory-copy preference, independent of account or analytics. */
@Injectable({ providedIn: 'root' })
export class HistoricalPlNoticePreferenceService {
  private readonly visible = signal(this.read());

  get isVisible(): boolean { return this.visible(); }

  setVisible(visible: boolean): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(HISTORICAL_PL_NOTICE_STORAGE_KEY,String(visible));
    } catch { /* Keep the current-browser-session choice when storage is unavailable. */ }
    this.visible.set(visible);
  }

  private read(): boolean {
    try {
      return typeof localStorage === 'undefined' || localStorage.getItem(HISTORICAL_PL_NOTICE_STORAGE_KEY) !== 'false';
    } catch { return true; }
  }
}
