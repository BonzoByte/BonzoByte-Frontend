import { environment } from '@env/environment';

/** Local presentation switch only. Keep the existing market calculations intact. */
export const PROBABILITY_FIRST = 'probabilityFirst' in environment && environment.probabilityFirst === true;

/** Explicit units avoid interpreting a 0.9% forecast as a 90% forecast. */
export function modelDecimalOdds(value: unknown, unit: 'fraction' | 'percent'): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const probability = unit === 'percent' ? value / 100 : value;
  if (probability <= 0 || probability >= 1) return null;
  const odds = 1 / probability;
  return Number.isFinite(odds) ? odds : null;
}
