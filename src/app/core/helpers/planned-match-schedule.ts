import type { Match } from '../models/tennis.model';

export const scheduleSchema = 'bonzobyte.planned-match-schedule.v1';
const minuteUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/;
const isoUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const id = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const utc = (value: unknown, format: RegExp): value is string => typeof value === 'string' && format.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const sourceDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit' });
function archiveDay(time: number): string {
  const dr = Object.fromEntries(sourceDate.formatToParts(time).map(x => [x.type, x.value]));
  return dr['year'] + dr['month'] + dr['day'];
}

interface Slot { player1: number; player2: number; start: string; }

/** Separate display feed: it cannot change completed data or grant eligibility for picks. */
export function applyPlannedMatchSchedule(rows: Match[], payload: unknown, day: string, now = Date.now()): Match[] {
  if (!payload || typeof payload !== 'object') return rows;
  const { schema, day: givenDay, observedAt, slots } = payload as Record<string, unknown>;
  if (schema !== scheduleSchema || givenDay !== day || !utc(observedAt, isoUtc) ||
      Date.parse(observedAt) > now + 120_000 || now - Date.parse(observedAt) > 36 * 3_600_000 ||
      !Array.isArray(slots) || !slots.length || slots.length > 500) return rows;
  const byId = new Map<number, Slot>();
  for (const entry of slots) {
    if (!Array.isArray(entry) || entry.length !== 4) return rows;
    const [match, player1, player2, start] = entry;
    if (!id(match) || !id(player1) || !id(player2) || player1 === player2 || byId.has(match) ||
        !utc(start, minuteUtc) || archiveDay(Date.parse(start)) !== day) return rows;
    byId.set(match, { player1, player2, start });
  }
  return rows.map(row => {
    const slot = byId.get(row.matchTPId);
    if (!slot) return { ...row, plannedStartChecked: true };
    return row.player1TPId === slot.player1 && row.player2TPId === slot.player2
      ? { ...row, plannedStartKind: 'not-before', plannedStartUtc: slot.start, plannedStartChecked: true }
      : row;
  });
}

export function isRecentScheduleDay(day: string, now = Date.now()): boolean {
  return [now - 86_400_000, now, now + 86_400_000, now + 172_800_000].some(time => archiveDay(time) === day);
}
