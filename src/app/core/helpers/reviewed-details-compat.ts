import type { MatchDetailsRaw } from '../models/match-details.model';

/** Read both published DTO spellings; contradictory eligibility fails closed. */
export function normalizeDetailsQuality(d: MatchDetailsRaw): MatchDetailsRaw {
  if (!d || !Object.prototype.hasOwnProperty.call(d, 'q')) return d;
  const q = d.q as unknown as Record<string, unknown> | null;
  const field = (camel: string, pascal: string): unknown => {
    if (!q || typeof q !== 'object') return undefined;
    const hasCamel = Object.prototype.hasOwnProperty.call(q, camel);
    const hasPascal = Object.prototype.hasOwnProperty.call(q, pascal);
    if (hasCamel && hasPascal && q[camel] !== q[pascal]) return undefined;
    return hasCamel ? q[camel] : q[pascal];
  };
  const status = field('status', 'Status');
  const reason = field('reason', 'Reason');
  const policy = field('policyVersion', 'PolicyVersion');
  const matchId = field('matchId', 'MatchId');
  const sha = field('assessmentSha256', 'AssessmentSha256');
  return { ...d, q: {
    status: typeof status === 'string' ? status : 'NotAssessed',
    reason: typeof reason === 'string' ? reason : '',
    calculationEligible: field('calculationEligible', 'CalculationEligible') === true,
    predictionEligible: field('predictionEligible', 'PredictionEligible') === true,
    policyVersion: typeof policy === 'string' ? policy : '',
    matchId: typeof matchId === 'number' && Number.isSafeInteger(matchId) ? matchId : undefined,
    assessmentSha256: typeof sha === 'string' ? sha : undefined,
  } };
}

/** Old exports used "21 64 46 75"; reviewed exports use "2:1 6:4 4:6 7:5". */
export function archiveSetTokens(details: string, main = ''): string[] {
  const tokens = details.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return tokens;
  const first = tokens[0];
  const mainDigits = main.replace(/\D/g, '');
  const sameAsMain = !!mainDigits && first.replace(/\D/g, '') === mainDigits;
  if ((/^\d{2}$/.test(first) || /^\d\s*:\s*\d$/.test(first)) &&
      (sameAsMain || (/^\d{2}$/.test(first) && tokens.length >= 3))) tokens.shift();
  return tokens;
}

export function archiveSetText(tokens: string[]): string {
  return tokens.map(t => t.trim()).filter(Boolean)
    .map(t => t.includes(':') ? t : t.replace(/^(\d)(\d)(\(\d+\))?$/, '$1:$2$3'))
    .join(' ');
}

export function archiveSetGames(token: string): { a: number; b: number } | null {
  const t = token.trim().replace(/^\[|\]$/g, '');
  const match = t.match(/^(\d+):(\d+)(?:\(\d+\))?$/) ?? t.match(/^(\d)(\d)(?:\(\d+\))?$/);
  return match ? { a: Number(match[1]), b: Number(match[2]) } : null;
}
