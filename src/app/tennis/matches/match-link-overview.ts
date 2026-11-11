import { MatchSummary } from '../../core/models/match-summary';
import { finalMatchResult } from '../../core/helpers/final-match-result';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const pair = (a: unknown, b: unknown): [number, number] | null => finite(a) && a > 1 && finite(b) && b > 1 ? [a, b] : null;

/** Presentation of public daily data only; no inferred scores or default predictions. */
export function matchLinkOverview(match: MatchSummary) {
    const held = !!match.qualityStatus && !['Validated', 'Incomplete', 'NonRatedOutcome'].includes(match.qualityStatus);
    const result = finalMatchResult(match);
    const tokens = result && match.resultDetails ? match.resultDetails.split(/\s+/).map(token =>
        token.replace(/^(\d)(\d)(\(\d+\))?$/, '$1:$2$3')) : [];
    if (tokens.length > 1 && tokens[0] === result) tokens.shift();
    const sets = tokens.length ? tokens.join(' ') : null;
    const verified = match.marketOddsVerified === true ? pair(match.player1Odds, match.player2Odds) : null;
    const legacy = pair(match.legacyPlayer1Odds, match.legacyPlayer2Odds);
    const odds = verified ?? legacy;
    const p1 = match.modelProbabilityPlayer1, p2 = match.modelProbabilityPlayer2;
    const allowed = !held && match.predictionEligible === true && match.qualityStatus !== 'NonRatedOutcome';
    const probabilities = allowed && finite(p1) && finite(p2) && p1 >= 0 && p1 <= 100 && p2 >= 0 && p2 <= 100 &&
        Math.abs(p1 + p2 - 100) < 0.01 ? [p1, p2] : null;
    const side = probabilities && probabilities[0] >= probabilities[1] ? 0 : 1;
    const confidence = probabilities?.[side] ?? null;
    const model = confidence === null ? null : { side, confidence,
        name: (side === 0 ? match.player1Name : match.player2Name) ?? '',
        tone: confidence >= 80 ? 'very-high' : confidence >= 70 ? 'high' : confidence >= 60 ? 'clear' : 'lean',
        label: confidence >= 80 ? 'veryHigh' : confidence >= 70 ? 'high' : confidence >= 60 ? 'clearLean' : 'lean' };
    const fair = verified ? (1 / verified[side]) / (1 / verified[0] + 1 / verified[1]) * 100 : null;
    const gap = confidence !== null && fair !== null ? confidence - fair : null;
    const market = model && verified && fair !== null && gap !== null ? {
        side, probability: fair, odds: verified[side], gap: Math.abs(gap) < 0.05 ? 0 : gap,
    } : null;
    return { held, result, sets, odds, verified: !!verified, model, market };
}
