import { ARCHIVE_TIME_ZONE, partsAt, resolveSourceTime, SourceTimePrecision, SourceTimeResolution } from './archive-day-window';
import { isCalendarDate, sourceCalendarDate } from './regional-format';

/** An explicit offset is an instant; never let Date.parse reinterpret a Zagreb wall clock. */
export function offsetInstant(raw: string): number | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,7})?)?(Z|[+-]\d{2}:\d{2})$/.exec(raw);
  if (!m || !isCalendarDate(m[1]) || +m[2] > 23 || +m[3] > 59 || +(m[4] ?? 0) > 59) return null;
  const n = Date.parse(raw);
  return Number.isFinite(n) ? n : null;
}

const matchTimes = new Map<string, SourceTimeResolution>();
/**
 * Presentation compatibility for existing archives (not model chronology): the old UI
 * displayed post-2003 non-midnight clocks. Interpret those as recorded scheduled Zagreb
 * times, not proof of actual start or second precision. Explicit producer metadata wins.
 * Legacy midnight, synthetic milliseconds and coarse historical dates never gain precision.
 */
export function matchDisplayTime(raw: string, precision?: SourceTimePrecision | null): SourceTimeResolution {
  if (typeof raw !== 'string' || !raw) return { instant: null, reason: 'unknown-time' };
  const key = `${precision ?? 'legacy'}:${raw}`;
  const cached = matchTimes.get(key);
  if (cached) return cached;
  let result: SourceTimeResolution = { instant: null, reason: 'unknown-time' };
  if (precision !== 'date' && precision !== 'unknown') {
    const explicit = offsetInstant(raw);
    if (explicit !== null) result = { instant: explicit, reason: 'known' };
    else {
      const day = sourceCalendarDate(raw);
      const clock = /[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(raw);
      const legacyClock = day && +day.slice(0, 4) >= 2004 && clock &&
        (clock[1] !== '00' || clock[2] !== '00') && !/[1-9]/.test(clock[4] ?? '');
      if (precision === 'minute' || precision === 'second' || legacyClock) {
        result = resolveSourceTime(raw.replace(' ', 'T'), precision ?? 'minute');
      }
    }
  }
  if (matchTimes.size >= 8192) matchTimes.clear();
  matchTimes.set(key, result);
  return result;
}

/** General DateTime fields with a defined source-zone or UTC contract (not birthdays). */
export function dateTimeInstant(raw: string, origin: 'source' | 'utc' = 'source'): number | null {
  if (/(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) return offsetInstant(raw);
  return origin === 'utc' ? offsetInstant(raw.replace(' ', 'T') + 'Z') : resolveSourceTime(raw.replace(' ', 'T'), 'second').instant;
}

export function instantParts(instant: number, zone = ARCHIVE_TIME_ZONE): { day: string; clock: string } {
  const p = partsAt(instant, zone);
  return { day: `${p['year']}-${p['month']}-${p['day']}`, clock: `${p['hour']}:${p['minute']}` };
}
