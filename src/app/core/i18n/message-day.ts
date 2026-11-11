import { dayAt, shiftDay } from './archive-day-window';
import { dateTimeInstant } from './display-time';
import { isCalendarDate, regionalDate } from './regional-format';
import { UiLocale } from './supported-languages';

const relativeFormats = new Map<UiLocale, Intl.RelativeTimeFormat>();

/** Message timestamps are UTC instants, never archive-day or browser-local keys. */
export function messageCalendarDay(value: string | null | undefined, zone: string): string | null {
  if (typeof value !== 'string' || !value) return null;
  const instant = dateTimeInstant(value, 'utc');
  return instant === null ? null : dayAt(instant, zone);
}

/** Compare civil dates, not elapsed 24-hour periods (DST days may be shorter/longer). */
export function messageDayLabel(day: string, today: string, locale: UiLocale): string {
  if (!isCalendarDate(day) || !isCalendarDate(today)) return '';
  const relative = day === today ? 0 : day === shiftDay(today, -1) ? -1 : null;
  if (relative === null || typeof Intl.RelativeTimeFormat !== 'function') return regionalDate(day, locale);
  let formatter = relativeFormats.get(locale);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    relativeFormats.set(locale, formatter);
  }
  const label = formatter.format(relative, 'day');
  return label.slice(0, 1).toLocaleUpperCase(locale) + label.slice(1);
}
