const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;

export const DETAILS_LOCK_HOURS = 2;

export interface DetailsAccessUser {
  isAdmin?: boolean;
  entitlements?: {
    isPremium?: boolean;
    hasTrial?: boolean;
  };
}

export interface ClientDetailsAccessDecision {
  locked: boolean;
  reason:
    | 'finished'
    | 'privileged'
    | 'time-unlocked'
    | 'future-locked'
    | 'unknown-time-day-ended'
    | 'unknown-time-locked'
    | 'unknown-time-open'
    | 'invalid-start';
  unlocksAt: string | null;
}

/**
 * Client-side projection of the backend policy, used only for the grid icon
 * and direct-static development mode. API mode always asks the backend.
 *
 * The checked planned time takes precedence over the archive clock. A valid
 * schedule with no entry for this match permits details but never enables picks.
 */
export function evaluateClientDetailsAccess({
  isFinished,
  user,
  scheduledStart,
  plannedStartUtc,
  plannedStartChecked,
  nowMs = Date.now(),
  lockHours = DETAILS_LOCK_HOURS,
}: {
  isFinished: unknown;
  user?: DetailsAccessUser | null;
  scheduledStart: unknown;
  plannedStartUtc?: string | null;
  plannedStartChecked?: boolean;
  nowMs?: number;
  lockHours?: number;
}): ClientDetailsAccessDecision {
  if (isFinishedValue(isFinished)) {
    return { locked: false, reason: 'finished', unlocksAt: null };
  }

  if (hasPrivilegedDetailsAccess(user)) {
    return { locked: false, reason: 'privileged', unlocksAt: null };
  }

  const hasPlannedStart = plannedStartChecked === true && !!plannedStartUtc;
  const schedule = parseExpectedStart(hasPlannedStart ? plannedStartUtc : scheduledStart);
  if (!Number.isFinite(nowMs) || !schedule) {
    return { locked: true, reason: 'invalid-start', unlocksAt: null };
  }
  if (plannedStartChecked && !hasPlannedStart && !schedule.hasKnownStartTime) {
    return { locked: false, reason: 'unknown-time-open', unlocksAt: null };
  }

  const normalizedLockHours =
    Number.isFinite(lockHours) && lockHours >= 0 ? lockHours : DETAILS_LOCK_HOURS;
  const hasKnownStartTime = hasPlannedStart || schedule.hasKnownStartTime;
  const unlockMs = hasKnownStartTime
    ? schedule.expectedStartMs - normalizedLockHours * MILLISECONDS_PER_HOUR
    : schedule.unknownTimeUnlockMs;
  const locked = nowMs < unlockMs;

  return {
    locked,
    reason: hasKnownStartTime
      ? (locked ? 'future-locked' : 'time-unlocked')
      : (locked ? 'unknown-time-locked' : 'unknown-time-day-ended'),
    unlocksAt: new Date(unlockMs).toISOString(),
  };
}

export function hasPrivilegedDetailsAccess(
  user?: DetailsAccessUser | null
): boolean {
  return Boolean(
    user?.isAdmin ||
    user?.entitlements?.isPremium ||
    user?.entitlements?.hasTrial
  );
}

function isFinishedValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function parseExpectedStart(value: unknown): {
  expectedStartMs: number;
  hasKnownStartTime: boolean;
  unknownTimeUnlockMs: number;
} | null {
  if (typeof value !== 'string' || !value.trim()) return null;

  const raw = value.trim();
  const datePart = raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!datePart || !isValidIsoDatePart(datePart)) return null;

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  // The ingestion pipeline adds synthetic milliseconds (.001, .002, ...)
  // to otherwise identical midnight fallbacks so their ordering is stable.
  // Those values still mean "source time unknown".
  const isMidnight = /T00:00(?::00(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/i.test(raw);
  const normalized =
    hasExplicitTimezone(raw) || isDateOnly ? raw : `${raw}Z`;
  const expectedStartMs = Date.parse(normalized);

  if (!Number.isFinite(expectedStartMs)) return null;

  const listedDayStartMs = Date.parse(`${datePart}T00:00:00.000Z`);
  return {
    expectedStartMs,
    hasKnownStartTime: !(isDateOnly || isMidnight),
    unknownTimeUnlockMs: listedDayStartMs + MILLISECONDS_PER_DAY,
  };
}

function hasExplicitTimezone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
}

function isValidIsoDatePart(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function normalizeDetailsHttpError(error: unknown): unknown {
  const payload =
    error !== null &&
    typeof error === 'object' &&
    'error' in error
      ? (error as { error?: unknown }).error
      : error;

  if (payload instanceof ArrayBuffer) {
    return parseJsonErrorBytes(new Uint8Array(payload), payload);
  }

  if (ArrayBuffer.isView(payload)) {
    return parseJsonErrorBytes(
      new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength),
      payload
    );
  }

  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }

  return payload;
}

function parseJsonErrorBytes(bytes: Uint8Array, fallback: unknown): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch {
    return fallback;
  }
}
