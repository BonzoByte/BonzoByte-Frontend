import { MatchSummary } from '../models/match-summary';

/** Display a supplied final result only; never infer a winner from odds or partial sets. */
export function finalMatchResult(match: MatchSummary): string | null {
    if (match.isFinished !== true || (match.qualityStatus &&
        !['Validated', 'Incomplete', 'NonRatedOutcome'].includes(match.qualityStatus))) return null;
    const result = match.result?.trim();
    if (!result || result.length > 32 || /[<>\p{Cc}\p{Cf}]/u.test(result)
        || /^(?:unknown|n\/a|null|undefined|-|0)$/i.test(result)) return null;
    const pair = /^(\d)\s*[:\-]?\s*(\d)$/.exec(result);
    return pair ? `${pair[1]}:${pair[2]}` : result;
}

/** Supplied set scores only, under the same finished/quality gate as the main result. */
export function finalMatchSets(match: MatchSummary): string | null {
    const result = finalMatchResult(match), details = match.resultDetails;
    if (!result || typeof details !== 'string' || details.length > 160 || /[<>\p{Cc}\p{Cf}]/u.test(details)) return null;
    const sets = details.trim().split(/\s+/).map(token => token
        .replace(/^(\d)(\d)(\(\d{1,2}\))?$/, '$1:$2$3').replace(/-/g, ':'));
    if (sets.length && sets[0] === result) sets.shift();
    if (!sets.length || !sets.every(token => /^(?:\d{1,2}:\d{1,2}(?:\(\d{1,2}\))?|\[\d{1,2}:\d{1,2}\])$/.test(token))) return null;
    return sets.join(' ');
}
