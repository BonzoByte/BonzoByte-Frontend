/** Format a UI decimal deterministically with the Croatian decimal comma. */
export function formatDecimal(value: number, fractionDigits: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(fractionDigits).replace('.', ',');
}

/** Whole-dollar tournament prize, with non-breaking spaces between digit groups. */
export function formatPrizeUsd(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '';
  return `${Math.round(value).toLocaleString('hr-HR').replace(/\./g, '\u00a0')} $`;
}
