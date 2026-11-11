import { formatDate } from '@angular/common';
import { Injectable } from '@angular/core';
import { RegionalSettingsService } from '../services/regional-settings.service';
import { sourceCalendarDate } from './regional-format';
import en from '../../../assets/i18n/en.json';

const normalizeCopy = (value: string) => value.trim().replace(/\s+/g, ' ');
const sourceKeys = new Map(Object.entries(en.reports.copy).map(([key, value]) =>
  [normalizeCopy(value), `reports.copy.${key}`]));

/** Presentation adapter for read-only research artifacts. Never mutates their contents. */
@Injectable({ providedIn: 'root' })
export class ReportPresentationService {
  private readonly optionsCache = new WeakMap<object, { language: string; value: object }>();
  constructor(public readonly regional: RegionalSettingsService) {}

  text(key: string, params?: Record<string, unknown>): string {
    return this.regional.text(`reports.messages.${key}`, params);
  }

  source(value: string | null | undefined): string {
    if (value == null) return '';
    const key = sourceKeys.get(normalizeCopy(value));
    if (key) return this.regional.text(key);
    const boundary = /^(Acceptance|Test) \/ out-of-sample from (\d{4}-\d{2}-\d{2})$/.exec(value);
    if (boundary && sourceCalendarDate(boundary[2])) {
      return this.text(boundary[1] === 'Test' ? 'testBoundary' : 'acceptanceBoundary', { date: this.regional.date(boundary[2]) });
    }
    // Unrecognized/new report wording remains verbatim, never an old conclusion by position or ID.
    return value;
  }

  surface(value: string): string {
    const code = value.trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(en.surfaces, code)
      ? this.regional.text(`surfaces.${code}`) : this.source(value);
  }

  feature(name: string, label: string): string {
    return label === name && Object.prototype.hasOwnProperty.call(en.nn.features, name)
      ? this.regional.text(`nn.features.${name}.label`) : this.source(label);
  }

  scope(value: string): string { return value === 'ALL' ? this.regional.text('common.all') : value; }
  period(value: string): string {
    const quarter = /^(\d{4})[- ]Q([1-4])$/.exec(value);
    return quarter ? this.text('quarter', { year: quarter[1], quarter: quarter[2] }) : value;
  }

  generatedAt(value: string | null | undefined): string {
    return this.regional.dateTime(value, 'utc');
  }

  utc(value: string | null | undefined): string {
    if (!value || !sourceCalendarDate(value)) return '';
    const instant = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
    if (!Number.isFinite(Date.parse(instant))) return '';
    return formatDate(instant, this.regional.settings().datePattern + ' HH:mm', this.regional.locale(), 'UTC');
  }

  /** Old overview count fields were serialized using .NET N0 with the host's culture. */
  countText(value: string): string {
    const raw = String(value).trim();
    const valid = /^\d+$/.test(raw) || /^(?:\d{1,3})([., \u00a0\u202f])\d{3}(?:\1\d{3})*$/.test(raw);
    if (!valid) return value;
    const count = Number(raw.replace(/[., \u00a0\u202f]/g, ''));
    return Number.isSafeInteger(count) ? this.regional.number(count, 0, true) : value;
  }

  /** These two legacy metrics are ungrouped .NET 0.00 strings, not input for calculations. */
  decimalText(value: string): string {
    const raw = String(value).trim();
    const match = /^([+-]?\d+)(?:([.,])(\d+))?(\s*%)?$/.exec(raw);
    if (!match) return value;
    const number = Number(match[1] + (match[3] ? '.' + match[3] : ''));
    return Number.isFinite(number) ? this.regional.number(number, match[3]?.length ?? 0, true) + (match[4] ?? '') : value;
  }

  /** New object identity on language changes prompts Chart.js to redraw axes and legends. */
  chartOptions<T extends object>(options: T): T {
    const language = this.regional.language();
    const cached = this.optionsCache.get(options);
    if (cached?.language === language) return cached.value as T;
    const clone = (value: any, key = ''): any => {
      if (typeof value === 'string' && (key === 'text' || key === 'label')) return this.source(value);
      if (Array.isArray(value)) return value.map(item => clone(item, key));
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v, k)]));
      return value;
    };
    const localized = { ...clone(options), locale: this.regional.locale() } as T;
    this.optionsCache.set(options, { language, value: localized });
    return localized;
  }
}
