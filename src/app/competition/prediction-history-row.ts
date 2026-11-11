import type { CompetitionPick } from '../core/services/competition.service';

export interface PredictionHistoryRow {
    pick: CompetitionPick;
    odds: (number | null)[];
    model: { side: number; name: string; confidence: number; tone: string; label: string; demo: boolean } | null;
    market: { side: number; probability: number; odds: number; gap: number | null } | null;
}

/** Uses only the accepted snapshot; never resolves current archives or recomputes a model. */
export function predictionHistoryRow(pick: CompetitionPick, localPreview = false): PredictionHistoryRow {
    const odds = [0, 1].map(side => {
        const value = pick.snapshot.odds?.[side];
        return typeof value === 'number' && Number.isFinite(value) && value > 1 ? value : null;
    });
    const saved = pick.snapshot.model;
    // Presentation-only examples never enter the fixture's snapshot or performance summary.
    const demo = localPreview && pick.matchTPId < 0 && !saved && Math.abs(pick.matchTPId) % 6 !== 0;
    const probability = demo ? [.63, .42, .78, .31, .84][(Math.abs(pick.matchTPId) - 1) % 5] : saved?.p1;
    let model: PredictionHistoryRow['model'] = null;
    if (typeof probability === 'number' && Number.isFinite(probability) && probability >= 0 && probability <= 1) {
        const side = probability >= .5 ? 0 : 1;
        const confidence = 100 * (side === 0 ? probability : 1 - probability);
        const tone = confidence >= 80 ? 'very-high' : confidence >= 70 ? 'high' : confidence >= 60 ? 'clear' : 'lean';
        const label = confidence >= 80 ? 'veryHigh' : confidence >= 70 ? 'high' : confidence >= 60 ? 'clearLean' : 'lean';
        model = { side, name: pick.snapshot.players[side]?.name || '', confidence, tone, label, demo };
    }
    let market: PredictionHistoryRow['market'] = null;
    const [first, second] = odds;
    if (first !== null && second !== null) {
        // As in the match grid, the market line compares the same side as the model.
        const side = model?.side ?? (first <= second ? 0 : 1);
        const price = side === 0 ? first : second;
        const probability = 100 * (1 / price) / (1 / first + 1 / second);
        const difference = model ? model.confidence - probability : null;
        market = { side, probability, odds: price, gap: difference === null ? null : Math.abs(difference) < .05 ? 0 : difference };
    }
    return { pick, odds, model, market };
}
