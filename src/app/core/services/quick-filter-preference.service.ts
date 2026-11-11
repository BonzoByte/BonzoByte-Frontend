import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface QuickFilterPreferences {
  odds: boolean;
  value: boolean;
  status: boolean;
}

const STORAGE_KEY = 'bonzobyte.quick-filter-preferences';
const DEFAULT_PREFERENCES: QuickFilterPreferences = {
  odds: false,
  value: false,
  status: false
};

@Injectable({ providedIn: 'root' })
export class QuickFilterPreferenceService {
  private readonly preferencesSubject = new BehaviorSubject<QuickFilterPreferences>(this.read());
  readonly preferences$ = this.preferencesSubject.asObservable();

  get current(): QuickFilterPreferences {
    return this.preferencesSubject.value;
  }

  set(preferences: QuickFilterPreferences): void {
    const normalized: QuickFilterPreferences = {
      odds: !!preferences.odds,
      value: !!preferences.value,
      status: !!preferences.status
    };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      }
    } catch {
      // The preference still applies for this session when storage is unavailable.
    }

    this.preferencesSubject.next(normalized);
  }

  private read(): QuickFilterPreferences {
    try {
      if (typeof localStorage === 'undefined') return { ...DEFAULT_PREFERENCES };

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PREFERENCES };

      const parsed = JSON.parse(raw) as Partial<QuickFilterPreferences>;
      return {
        odds: !!parsed.odds,
        value: !!parsed.value,
        status: !!parsed.status
      };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }
}
