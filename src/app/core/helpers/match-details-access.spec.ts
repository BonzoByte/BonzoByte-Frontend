import {
  evaluateClientDetailsAccess,
  hasPrivilegedDetailsAccess,
  normalizeDetailsHttpError,
} from './match-details-access';

describe('match-details access policy', () => {
  const nowMs = Date.parse('2026-07-27T10:00:00.000Z');

  it('opens finished matches even when their start is in the future', () => {
    expect(evaluateClientDetailsAccess({
      isFinished: true,
      scheduledStart: '2026-07-29T12:00:00Z',
      nowMs,
    }).locked).toBeFalse();
  });

  it('locks an unfinished free match more than one hour away', () => {
    expect(evaluateClientDetailsAccess({
      isFinished: false,
      scheduledStart: '2026-07-27T11:00:00.001Z',
      nowMs,
    }).locked).toBeTrue();
  });

  it('opens at the exact one-hour boundary', () => {
    expect(evaluateClientDetailsAccess({
      isFinished: false,
      scheduledStart: '2026-07-27T11:00:00.000Z',
      nowMs,
    }).locked).toBeFalse();
  });

  it('opens old unfinished matches', () => {
    expect(evaluateClientDetailsAccess({
      isFinished: false,
      scheduledStart: '2020-01-02T12:00:00Z',
      nowMs,
    }).locked).toBeFalse();
  });

  it('opens future matches for privileged users', () => {
    const user = { entitlements: { hasTrial: true } };
    expect(hasPrivilegedDetailsAccess(user)).toBeTrue();
    expect(evaluateClientDetailsAccess({
      isFinished: false,
      user,
      scheduledStart: '2026-07-29T12:00:00Z',
      nowMs,
    }).locked).toBeFalse();
  });

  it('fails safe for invalid timestamps', () => {
    const result = evaluateClientDetailsAccess({
      isFinished: false,
      scheduledStart: 'not-a-date',
      nowMs,
    });

    expect(result.locked).toBeTrue();
    expect(result.reason).toBe('invalid-start');
    expect(result.unlocksAt).toBeNull();
  });

  it('locks an unknown midnight time through its listed day', () => {
    const duringDay = evaluateClientDetailsAccess({
      isFinished: false,
      scheduledStart: '2026-07-27T00:00:00',
      nowMs,
    });
    const afterDay = evaluateClientDetailsAccess({
      isFinished: false,
      scheduledStart: '2026-07-27T00:00:00',
      nowMs: Date.parse('2026-07-28T00:00:00.000Z'),
    });

    expect(duringDay.locked).toBeTrue();
    expect(duringDay.unlocksAt).toBe('2026-07-28T00:00:00.000Z');
    expect(afterDay.locked).toBeFalse();
  });

  it('treats synthetic midnight ordering milliseconds as unknown time', () => {
    for (const scheduledStart of [
      '2026-07-27T00:00:00.001',
      '2026-07-27T00:00:00.002Z',
    ]) {
      const result = evaluateClientDetailsAccess({
        isFinished: false,
        scheduledStart,
        nowMs,
      });

      expect(result.locked).toBeTrue();
      expect(result.reason).toBe('unknown-time-locked');
      expect(result.unlocksAt).toBe('2026-07-28T00:00:00.000Z');
    }
  });

  it('decodes a DETAILS_LOCKED JSON body returned as an ArrayBuffer', () => {
    const payload = {
      status: 'error',
      code: 'DETAILS_LOCKED',
      unlocksAt: '2026-07-27T11:00:00.000Z',
      lockHours: 1,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const result = normalizeDetailsHttpError({ error: bytes.buffer });

    expect(result).toEqual(payload);
  });
});
