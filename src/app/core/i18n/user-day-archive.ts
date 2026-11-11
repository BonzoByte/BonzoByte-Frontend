import { Match } from '../models/tennis.model';
import { ArchiveDayWindow, isInArchiveDay } from './archive-day-window';
import { matchDisplayTime } from './display-time';
import { sourceCalendarDate } from './regional-format';

export interface DailySnapshot { archiveDay: string; matches: Match[]; missing?: boolean; }
export interface UserDayArchive {
  matches: Match[];
  unresolvedCount: number;
  missingDays: string[];
  archiveDays: string[];
}

/** Merge before filtering: a later daily snapshot may move a postponed match to another day. */
export function mergeUserDay(window: ArchiveDayWindow, snapshots: readonly DailySnapshot[]): UserDayArchive {
  const records = new Map<number, Match>();
  const aliases = new Map<string, number>();
  let next = 0;
  for (const snapshot of [...snapshots].sort((a, b) => a.archiveDay.localeCompare(b.archiveDay))) {
    for (const row of snapshot.matches) {
      const keys = [Number(row.matchId) > 0 ? `id:${row.matchId}` : '', Number(row.matchTPId) > 0 ? `tp:${row.matchTPId}` : ''].filter(Boolean);
      const previous = keys.map(key => aliases.get(key)).filter((n): n is number => n !== undefined);
      const id = previous[0] ?? next++;
      for (const old of previous) if (old !== id) {
        records.delete(old);
        for (const [alias, target] of aliases) if (target === old) aliases.set(alias, id);
      }
      records.set(id, row);
      for (const key of keys) aliases.set(key, id);
    }
  }
  let unresolvedCount = 0;
  const matches = [...records.values()].filter(row => {
    const time = matchDisplayTime(row.dateTime, row.sourceTimePrecision);
    if (time.instant !== null) return isInArchiveDay(time.instant, window);
    // No fabricated midnight, no shift, no copy into several local days.
    if (sourceCalendarDate(row.dateTime) !== window.userDay) return false;
    unresolvedCount++;
    return true;
  });
  return { matches, unresolvedCount, archiveDays: snapshots.map(s => s.archiveDay),
    missingDays: snapshots.filter(s => s.missing && window.archiveDays.includes(s.archiveDay)).map(s => s.archiveDay) };
}
