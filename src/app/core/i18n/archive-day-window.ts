import { isCalendarDate } from './regional-format';

export const ARCHIVE_TIME_ZONE = 'Europe/Zagreb';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string): Intl.DateTimeFormat {
  let value = formatters.get(zone);
  if (!value) {
    value = new Intl.DateTimeFormat('en-GB-u-ca-iso8601-nu-latn', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
    // Limit retained user-provided zone names, including aliases.
    if (formatters.size >= 64) formatters.clear();
    formatters.set(zone, value);
  }
  return value;
}

export function validTimeZone(zone: string): boolean {
  try { formatter(zone); return true; } catch { return false; }
}

export function detectedTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && validTimeZone(zone) ? zone : ARCHIVE_TIME_ZONE;
  } catch { return ARCHIVE_TIME_ZONE; }
}

export function partsAt(instant: number, zone: string): Record<string, string> {
  return Object.fromEntries(formatter(zone).formatToParts(instant).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}

export function dayAt(instant: number, zone: string): string {
  const p = partsAt(instant, zone);
  return `${p['year']}-${p['month']}-${p['day']}`;
}

export function shiftDay(day: string, offset = 1): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + offset * DAY).toISOString().slice(0, 10);
}
const nextDay = (day: string) => shiftDay(day);

/** Find the first instant at/after a civil date. Also handles DST gaps at midnight and skipped days. */
function dayBoundary(day: string, zone: string): number {
  const center = Date.parse(`${day}T00:00:00Z`);
  // Fast path for ordinary midnights; verify both sides before trusting an offset.
  const p = partsAt(center, zone);
  const offset = Date.parse(`${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}:${p['second']}Z`) - center;
  const midnight = center - offset;
  const local = partsAt(midnight, zone);
  if (dayAt(midnight - 1, zone) < day && dayAt(midnight, zone) === day &&
      local['hour'] === '00' && local['minute'] === '00' && local['second'] === '00') return midnight;
  let low = center - 2 * DAY;
  let high = center + 2 * DAY;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (dayAt(mid, zone) < day) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** Candidate calendar days, including the source-day bucket for records without a clock. */
export function projectArchiveDates(sourceDays: readonly string[], zone: string): string[] {
  if (zone === ARCHIVE_TIME_ZONE) return [...sourceDays];
  const days = new Set<string>();
  for (const sourceDay of sourceDays) {
    if (!isCalendarDate(sourceDay)) continue;
    days.add(sourceDay);
    const source = planArchiveDay(sourceDay, ARCHIVE_TIME_ZONE);
    const last = dayAt(source.endExclusive - 1, zone);
    for (let d = dayAt(source.startInclusive, zone); d <= last; d = nextDay(d)) days.add(d);
  }
  return [...days].sort();
}

export interface ArchiveDayWindow {
  startInclusive: number;
  endExclusive: number;
  archiveDays: string[];
  userDay: string;
  userZone: string;
}

/** Pure planning: does not fetch, modify archive keys or change model chronology. */
export function planArchiveDay(userDay: string, userZone: string): ArchiveDayWindow {
  if (!isCalendarDate(userDay) || !validTimeZone(userZone)) throw new Error('Invalid calendar date or time zone.');
  const startInclusive = dayBoundary(userDay, userZone);
  const endExclusive = dayBoundary(nextDay(userDay), userZone);
  const archiveDays: string[] = [];
  if (startInclusive < endExclusive) {
    const last = dayAt(endExclusive - 1, ARCHIVE_TIME_ZONE);
    for (let day = dayAt(startInclusive, ARCHIVE_TIME_ZONE); day <= last; day = nextDay(day)) archiveDays.push(day);
  }
  return { startInclusive, endExclusive, archiveDays, userDay, userZone };
}

export type SourceTimePrecision = 'minute' | 'second' | 'date' | 'unknown';
export interface SourceTimeResolution {
  instant: number | null;
  reason: 'known' | 'unknown-time' | 'invalid-time' | 'ambiguous-time' | 'nonexistent-time';
}

/**
 * Only the producer may assert known precision. A nonzero hour or synthetic milliseconds
 * do not establish that precision. Offset-free values are Zagreb civil time, never UTC.
 * Ambiguous autumn hours require source evidence; we do not choose either occurrence.
 */
export function resolveSourceTime(raw: string, precision?: SourceTimePrecision): SourceTimeResolution {
  if (precision !== 'minute' && precision !== 'second') return { instant: null, reason: 'unknown-time' };
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,7}))?)?$/.exec(raw);
  if (!m || !isCalendarDate(m[1]) || +m[2] > 23 || +m[3] > 59 || +(m[4] ?? 0) > 59) return { instant: null, reason: 'invalid-time' };
  const wall = Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4] ?? '00'}.${(m[5] ?? '').padEnd(3, '0').slice(0, 3)}Z`);
  const offsets = new Set<number>();
  // Observe both sides of any nearby Zagreb DST transition.
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = Math.floor((wall + hours * HOUR) / 1000) * 1000;
    const p = partsAt(sample, ARCHIVE_TIME_ZONE);
    const local = Date.parse(`${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}:${p['second']}Z`);
    offsets.add(local - sample);
  }
  const candidates = [...offsets].map(offset => wall - offset).filter(instant => {
    const p = partsAt(instant, ARCHIVE_TIME_ZONE);
    return `${p['year']}-${p['month']}-${p['day']}` === m[1] && p['hour'] === m[2] && p['minute'] === m[3] && p['second'] === (m[4] ?? '00');
  });
  if (candidates.length !== 1) return { instant: null, reason: candidates.length ? 'ambiguous-time' : 'nonexistent-time' };
  return { instant: candidates[0], reason: 'known' };
}

export function isInArchiveDay(instant: number, window: ArchiveDayWindow): boolean {
  return Number.isFinite(instant) && instant >= window.startInclusive && instant < window.endExclusive;
}
