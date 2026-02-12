/* eslint-disable @typescript-eslint/no-explicit-any */
import { MatchDetailsRaw } from '../../../core/models/match-details.model';

export type TsScope = 'M' | 'SM' | 'GSM';
export type Surface = 1 | 2 | 3 | 4;
export type Who = 'p1' | 'p2';

const BLOCK = 9;

const TS_BASE: Record<TsScope, number> = {
  M: 23,
  SM: 32,
  GSM: 41,
};

const TS_SURFACE_BASE: Record<TsScope, number> = {
  M: 50,   // MS1
  SM: 59,  // SMS1
  GSM: 68, // GSMS1
};

const OFF = {
  p1Mean: 0,
  p1Sd: 1,
  p2Mean: 2,
  p2Sd: 3,
  p1OldMean: 4,
  p1OldSd: 5,
  p2OldMean: 6,
  p2OldSd: 7,
  p1WinProb: 8, // 0..1
} as const;

function mKey(n: number) {
  return `m${String(n).padStart(3, '0')}`;
}

function getTsBlockStart(scope: TsScope, surface?: Surface): number {
  if (!surface) return TS_BASE[scope];
  // per surface: (M, SM, GSM) blocks => 3 * 9
  return TS_SURFACE_BASE[scope] + (surface - 1) * (3 * BLOCK);
}

export function getTs(d: MatchDetailsRaw, scope: TsScope, who: Who, surface?: Surface) {
  const start = getTsBlockStart(scope, surface);

  const mean    = d[mKey(start + (who === 'p1' ? OFF.p1Mean : OFF.p2Mean))] as number;
  const sd      = d[mKey(start + (who === 'p1' ? OFF.p1Sd   : OFF.p2Sd))] as number;
  const oldMean = d[mKey(start + (who === 'p1' ? OFF.p1OldMean : OFF.p2OldMean))] as number;
  const oldSd   = d[mKey(start + (who === 'p1' ? OFF.p1OldSd   : OFF.p2OldSd))] as number;

  const p1WinProb = d[mKey(start + OFF.p1WinProb)] as number; // 0..1
  const winProb = who === 'p1' ? p1WinProb : (1 - p1WinProb);

  return { mean, sd, oldMean, oldSd, winProb };
}

export function winProbToPct(p: number | null | undefined): string {
  if (p == null || Number.isNaN(p)) return '–';
  return `${(p * 100).toFixed(1)}%`;
}

export function pctAlready(p: number | null | undefined): string {
  // for fields already in percent like m655 sample 50.0
  if (p == null || Number.isNaN(p)) return '–';
  return `${p.toFixed(1)}%`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(); // uses browser locale; OK for MVP
}

export function safeText(v: any): string {
  if (v == null) return '–';
  const s = String(v).trim();
  return s.length ? s : '–';
}