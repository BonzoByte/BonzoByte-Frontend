/** Presentation only. Never use localized text as an API/archive key or calculation input. */
import { languageSettings, localeSettings, UiLanguage, UiLocale } from './supported-languages';
export type { UiLanguage, UiLocale } from './supported-languages';
export const localeForLanguage = (language: UiLanguage): UiLocale => languageSettings(language).locale;

const numberFormats = new Map<string, Intl.NumberFormat>();
const numberLocales = new Map<UiLocale, UiLocale>();
function numberFormattingLocale(locale: UiLocale): UiLocale {
  const cached = numberLocales.get(locale);
  if (cached) return cached;
  const settings = localeSettings(locale);
  let resolved = locale;
  if ('numberLocaleFallback' in settings) {
    const decimal = new Intl.NumberFormat(locale).formatToParts(1.5).find(part => part.type === 'decimal')?.value;
    if (decimal !== settings.decimalSeparator) resolved = settings.numberLocaleFallback;
  }
  numberLocales.set(locale, resolved);
  return resolved;
}

export function regionalNumber(value: number | null | undefined, locale: UiLocale, digits = 2, grouping = false): string {
  if (value == null || !Number.isFinite(value)) return '';
  const precision = Math.max(0, Math.min(20, Math.trunc(digits)));
  const key = `${locale}:${precision}:${grouping}`;
  let formatter = numberFormats.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(numberFormattingLocale(locale), { minimumFractionDigits: precision, maximumFractionDigits: precision, useGrouping: grouping });
    numberFormats.set(key, formatter);
  }
  // Display rounded zero without a misleading minus sign.
  return formatter.formatToParts(Math.abs(value) < 0.5 * 10 ** -precision ? 0 : value)
    // Keep the existing compact P/L sign convention across supported locales.
    .map(part => part.type === 'minusSign' ? '-' : part.value).join('');
}

export function regionalUsd(value: number | null | undefined, locale: UiLocale): string {
  if (value == null || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat(numberFormattingLocale(locale), { style: 'currency', currency: 'USD', currencyDisplay: 'code', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(value);
}

export function isCalendarDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m || +m[1] < 1000) return false;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return date.getUTCFullYear() === +m[1] && date.getUTCMonth() === +m[2] - 1 && date.getUTCDate() === +m[3];
}

/** Extract the recorded calendar date, not the browser's interpretation of an instant. */
export function sourceCalendarDate(value: string | null | undefined): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:$|T| )/.exec(value ?? '');
  return match && isCalendarDate(match[1]) ? match[1] : null;
}

export function regionalDate(value: string | null | undefined, locale: UiLocale): string {
  const date = sourceCalendarDate(value);
  if (!date) return '';
  const [year, month, day] = date.split('-');
  const settings = localeSettings(locale);
  const fields = { year, month, day };
  return settings.dateFields.map(field => fields[field]).join(settings.dateSeparator) + settings.dateSuffix;
}

export function regionalDateInput(value: string | null | undefined, locale: UiLocale): string {
  return regionalDate(value, locale).replace(/\.$/, '');
}

/** Parse the selected field order; never guess an alternative day/month order. */
export function parseRegionalDate(value: string, locale: UiLocale, acceptAlternateSeparators = false): string | null {
  const settings = localeSettings(locale);
  const text = value.trim();
  const separator = acceptAlternateSeparators ? /[.\/-]/ : settings.dateSeparator;
  // Preserve the optional trailing dot accepted by the existing dotted date controls.
  const entry = settings.dateSeparator === '.' ? text.replace(/\.$/, '') : text;
  const parts = entry.split(separator);
  if (parts.length !== 3) return null;
  const fields = { year: '', month: '', day: '' };
  for (let i = 0; i < settings.dateFields.length; i++) {
    const field = settings.dateFields[i];
    if (!(field === 'year' ? /^\d{4}$/ : /^\d{2}$/).test(parts[i])) return null;
    fields[field] = parts[i];
  }
  const iso = `${fields.year}-${fields.month}-${fields.day}`;
  return isCalendarDate(iso) ? iso : null;
}

/** Preserve incomplete segments while editing; compact input follows the same locale order. */
export function maskRegionalDateInput(value: string, locale: UiLocale, acceptAlternateSeparators = false): string {
  const settings = localeSettings(locale);
  const widths = settings.dateFields.map(field => field === 'year' ? 4 : 2);
  const parts = value.split(acceptAlternateSeparators ? /[.\/-]/ : settings.dateSeparator);
  if (parts.length === 3) {
    return parts.map((part, i) => part.replace(/\D/g, '').slice(0, widths[i])).join(settings.dateSeparator);
  }
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const segments: string[] = [];
  let offset = 0;
  for (const width of widths) {
    if (offset >= digits.length) break;
    segments.push(digits.slice(offset, offset + width));
    offset += width;
  }
  return segments.join(settings.dateSeparator);
}

/** Strict decimal entry. Grouping separators are intentionally not accepted in numeric filters. */
export function parseRegionalNumber(value: string, locale: UiLocale): number | null {
  const text = value.trim();
  const valid = localeSettings(locale).decimalSeparator === ',' ? /^[+-]?\d+(?:,\d+)?$/ : /^[+-]?\d+(?:\.\d+)?$/;
  if (!valid.test(text)) return null;
  const number = Number(localeSettings(locale).decimalSeparator === ',' ? text.replace(',', '.') : text);
  return Number.isFinite(number) ? number : null;
}
