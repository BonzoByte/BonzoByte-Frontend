import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export const TIME_ZONE_NOTICE_STORAGE_KEY = 'bonzobyte.timeZoneNotice.visible.v1';

/** Browser-local preference, shared by signed-in users and anonymous visitors.
 * Dismissal is permanent until explicitly re-enabled, not a timed snooze.
 * This controls explanatory copy only, never data-coverage/error warnings.
 */
@Injectable({ providedIn: 'root' })
export class TimeZoneNoticePreferenceService {
  private readonly visibleSubject = new BehaviorSubject<boolean>(this.read());
  readonly visible$ = this.visibleSubject.asObservable();

  get isVisible(): boolean { return this.visibleSubject.value; }

  setVisible(visible: boolean): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(TIME_ZONE_NOTICE_STORAGE_KEY, String(visible));
    } catch { /* Keep the in-memory choice when browser storage is blocked/full. */ }
    this.visibleSubject.next(visible);
  }

  private read(): boolean {
    try {
      return typeof localStorage === 'undefined' || localStorage.getItem(TIME_ZONE_NOTICE_STORAGE_KEY) !== 'false';
    } catch { return true; }
  }
}
