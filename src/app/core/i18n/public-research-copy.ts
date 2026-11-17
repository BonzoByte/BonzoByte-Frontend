/** Display-only compatibility for older reports. Never rewrites their evidence or metrics. */
export const normalizeResearchCopy = (value: string): string => value.trim().replace(/\s+/g, ' ');

// Only presentation prose passes through this adapter, not source IDs, links or attribution records.
export function neutralResearchCopy(value: string): string {
  return value.replace(/\bTennis\s*(?:Explorer|Prediction)(?:\.com)?\b/gi, '')
    .replace(/ {2,}/g, ' ').replace(/ +([,.;:])/g, '$1').trim();
}

// Match the entire known paragraph, including its methodology limitations. Do not
// classify a new conclusion by its position, report ID or a loose keyword match.
export const LEGACY_RECONSTRUCTION_COPY = normalizeResearchCopy(
  'Chronological retrospective reconstruction using yearly fitted models, selected after historical research; not an untouched prospective holdout or evidence of achievable returns. Archived bookmaker medians are accepted as historical reference prices, including a single complete pair. Quote availability before the match is unconfirmed. Missing predictions and incomplete or unverified outcomes are excluded, never replaced by 50%.');
