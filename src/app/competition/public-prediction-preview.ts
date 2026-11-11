import type { CompetitionPick } from '../core/services/competition.service';
import { publicPredictionIdentities } from './public-prediction-identities';
import { predictionPreviewMatch } from './prediction-preview-metadata';

/** Read-only presentation copies, never used for writes, summaries or real match navigation. */
export function publicPredictionPreview(entries: CompetitionPick[], enabled: boolean): CompetitionPick[] {
    if (!enabled) return entries;
    let changed = false;
    const result = entries.map(pick => {
        // The existing database fixture uses epochDay * 10 + slot (three slots/day).
        // Map the complete fixture calendar, not a user's row order, so participants
        // always see the same archived matchup for the same invented match.
        const encoded = pick.matchTPId - 8000000000000000;
        if (!Number.isSafeInteger(encoded) || encoded < 0 || encoded >= 1000000 || encoded % 10 > 2
            || pick.snapshot.matchTPId !== pick.matchTPId || pick.snapshot.model !== null
            || pick.snapshot.players.length !== 2 || !pick.snapshot.players.every(p => /^Demo Player \d+$/.test(p.name))) return pick;
        const ordinal = Math.floor(encoded / 10) * 3 + encoded % 10;
        const identity = publicPredictionIdentities[ordinal % publicPredictionIdentities.length];
        const matchTPId = -(ordinal + 1);
        changed = true;
        const display = { ...pick, matchTPId, snapshot: { ...pick.snapshot, matchTPId,
            tournament: identity.tournament,
            players: identity.players.map((player, side) => ({ ...player, id: -(ordinal * 2 + side + 1) })),
        } };
        return { ...display, previewMatch: predictionPreviewMatch(display, identity.sourceMatchId) };
    });
    return changed ? result : entries;
}
