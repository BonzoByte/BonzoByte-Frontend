import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export const BONZOBYTE_THEMES = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'wimbledon', label: 'Wimbledon' },
  { id: 'roland-garros', label: 'Roland Garros' },
  { id: 'us-open', label: 'US Open' },
] as const;

export type BonzoByteTheme = typeof BONZOBYTE_THEMES[number]['id'];

const STORAGE_KEY = 'bonzobyte.theme';
const DEFAULT_THEME: BonzoByteTheme = 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly selectedThemeSubject =
    new BehaviorSubject<BonzoByteTheme>(DEFAULT_THEME);

  readonly selectedTheme$ = this.selectedThemeSubject.asObservable();

  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    this.setTheme(this.readStoredTheme(), false);
  }

  get selectedTheme(): BonzoByteTheme {
    return this.selectedThemeSubject.value;
  }

  setTheme(theme: string, persist = true): void {
    const selected = isBonzoByteTheme(theme) ? theme : DEFAULT_THEME;
    this.document.documentElement.dataset['bbTheme'] = selected;
    this.selectedThemeSubject.next(selected);

    if (!persist) return;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, selected);
      }
    } catch {
      // Theme selection still works when browser storage is unavailable.
    }
  }

  private readStoredTheme(): BonzoByteTheme {
    try {
      const stored =
        typeof localStorage === 'undefined'
          ? null
          : localStorage.getItem(STORAGE_KEY);
      if (isBonzoByteTheme(stored)) return stored;
    } catch {
      return DEFAULT_THEME;
    }
    return DEFAULT_THEME;
  }
}

function isBonzoByteTheme(value: unknown): value is BonzoByteTheme {
  return BONZOBYTE_THEMES.some(theme => theme.id === value);
}
