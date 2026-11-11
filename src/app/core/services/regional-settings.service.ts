import { DOCUMENT, registerLocaleData } from '@angular/common';
import { computed, Inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { regionalDate, regionalDateInput, regionalNumber, regionalUsd } from '../i18n/regional-format';
import { DEFAULT_LANGUAGE, isSupportedLanguage, languageSettings, SUPPORTED_LANGUAGES, UiLanguage } from '../i18n/supported-languages';
import { ARCHIVE_TIME_ZONE, detectedTimeZone, SourceTimePrecision, validTimeZone } from '../i18n/archive-day-window';
import { dateTimeInstant, instantParts, matchDisplayTime } from '../i18n/display-time';

export const LANGUAGE_STORAGE_KEY = 'bonzobyte.ui.language.v1';
export const TIME_ZONE_STORAGE_KEY = 'bonzobyte.ui.timeZone.v1';
for (const language of SUPPORTED_LANGUAGES) registerLocaleData(language.angularLocale, language.locale);

@Injectable({ providedIn: 'root' })
export class RegionalSettingsService {
  private readonly pluralRulesByLocale = new Map<string,Intl.PluralRules>();
  readonly supportedLanguages = SUPPORTED_LANGUAGES;
  private readonly selectedLanguage = signal<UiLanguage>(DEFAULT_LANGUAGE.code);
  readonly language = this.selectedLanguage.asReadonly();
  readonly settings = computed(() => languageSettings(this.language()));
  readonly locale = computed(() => this.settings().locale);
  readonly datePlaceholder = computed(() => this.settings().datePlaceholder);
  readonly dateSeparator = computed(() => this.settings().dateSeparator);
  readonly decimalSeparator = computed(() => this.settings().decimalSeparator);
  readonly changes = new Subject<UiLanguage>();
  readonly detectedZone = detectedTimeZone();
  private readonly selectedTimeZone = signal('auto');
  readonly timeZoneSelection = this.selectedTimeZone.asReadonly();
  readonly timeZone = computed(() => this.selectedTimeZone() === 'auto' ? this.detectedZone : this.selectedTimeZone());
  readonly timeZoneChanges = new Subject<string>();
  readonly timeZoneOptions = this.listTimeZones();
  /** This is the active archive-day contract, not a detected/user display zone. */
  readonly sourceTimeZone = 'Europe/Zagreb';

  constructor(private translate: TranslateService, @Inject(DOCUMENT) private document: Document) {
    // Bundled dictionaries avoid loading races during startup or language changes.
    for (const language of SUPPORTED_LANGUAGES) translate.setTranslation(language.code, language.messages, true);
    translate.setDefaultLang(DEFAULT_LANGUAGE.code);
    let saved: string | null = null;
    try { saved = document.defaultView?.localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? null; } catch { /* Storage may be disabled. */ }
    try {
      const zone = document.defaultView?.localStorage.getItem(TIME_ZONE_STORAGE_KEY);
      if (zone && (zone === 'auto' || validTimeZone(zone))) {
        this.selectedTimeZone.set(zone);
        if (zone !== 'auto' && !this.timeZoneOptions.includes(zone)) this.timeZoneOptions.push(zone);
      }
    } catch { /* Keep browser detection when storage is disabled. */ }
    this.setLanguage(isSupportedLanguage(saved) ? saved : DEFAULT_LANGUAGE.code);
  }

  private listTimeZones(): string[] {
    let zones: string[] = [];
    try { zones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? []; } catch { /* Older engines retain common choices. */ }
    return [...new Set([ARCHIVE_TIME_ZONE, this.detectedZone, 'UTC', 'America/New_York', 'America/Los_Angeles',
      'Europe/London', 'Asia/Tokyo', 'Asia/Kathmandu', 'Australia/Sydney', 'Pacific/Honolulu', 'Pacific/Kiritimati', ...zones])].sort();
  }

  setTimeZone(zone: string): void {
    if (zone !== 'auto' && !validTimeZone(zone)) return;
    const before = this.timeZone();
    this.selectedTimeZone.set(zone);
    if (zone !== 'auto' && !this.timeZoneOptions.includes(zone)) this.timeZoneOptions.push(zone);
    try { this.document.defaultView?.localStorage.setItem(TIME_ZONE_STORAGE_KEY, zone); } catch { /* In-memory preference still works. */ }
    if (this.timeZone() !== before) {
      this.changes.next(this.language()); // Refresh cached presentation such as open detail modals.
      this.timeZoneChanges.next(this.timeZone());
    }
  }

  dateTime(value: string | null | undefined, origin: 'source' | 'utc' = 'source'): string {
    if (!value) return '';
    const instant = dateTimeInstant(value, origin);
    if (instant == null) return this.date(value);
    const parts = instantParts(instant, this.timeZone());
    return this.date(parts.day) + ' ' + parts.clock;
  }

  matchDateTime(value: string | null | undefined, precision?: SourceTimePrecision | null, onlyDate = false): string {
    if (!value) return '';
    const resolved = matchDisplayTime(value, precision);
    if (resolved.instant == null) return this.date(value);
    const parts = instantParts(resolved.instant, this.timeZone());
    return this.date(parts.day) + (onlyDate ? '' : ' ' + parts.clock);
  }

  setLanguage(language: UiLanguage): void {
    if (!isSupportedLanguage(language)) return;
    this.translate.use(language).subscribe(() => {
      this.selectedLanguage.set(language);
      this.document.documentElement.lang = language;
      this.document.documentElement.dir = this.settings().direction;
      try { this.document.defaultView?.localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* In-memory preference still works. */ }
      this.changes.next(language);
    });
  }

  number(value: number | null | undefined, digits = 2, grouping = false): string { return regionalNumber(value, this.locale(), digits, grouping); }
  usd(value: number | null | undefined): string { return regionalUsd(value, this.locale()); }
  date(value: string | null | undefined): string { return regionalDate(value, this.locale()); }
  dateInput(value: string | null | undefined): string { return regionalDateInput(value, this.locale()); }
  text(key: string, parameters?: Record<string, unknown>): string {
    this.language(); // Track language changes when read by a template/computed value.
    return this.translate.instant(key, parameters) as string;
  }
  plural(key: string, count: number): string {
    const locale = this.locale();
    let rules = this.pluralRulesByLocale.get(locale);
    if (!rules) { rules = new Intl.PluralRules(locale); this.pluralRulesByLocale.set(locale,rules); }
    const category = rules.select(count);
    return this.text(`${key}.${category}`, { count: this.number(count, 0, true) });
  }
}
