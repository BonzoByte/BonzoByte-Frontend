/** Display-only aggregation of the grid's existing forecast and result decisions. */
export interface TournamentForecastSummary {
    total: number; forecasts: number; graded: number; correct: number;
    pending: number; excluded: number; accuracy: number | null;
}
export interface TournamentForecastState {
    forecast: boolean; outcome: 'correct' | 'incorrect' | null; pending: boolean;
}
export function summarizeTournamentForecasts<T>(rows: readonly T[], classify: (row: T) => TournamentForecastState): TournamentForecastSummary {
    const summary: TournamentForecastSummary = { total: rows.length, forecasts: 0, graded: 0, correct: 0, pending: 0, excluded: 0, accuracy: null };
    for (const row of rows) {
        const state = classify(row);
        if (!state.forecast) { summary.excluded++; continue; }
        summary.forecasts++;
        if (state.outcome) { summary.graded++; if (state.outcome === 'correct') summary.correct++; }
        else if (state.pending) summary.pending++;
        else summary.excluded++;
    }
    if (summary.graded > 0) summary.accuracy = 100 * summary.correct / summary.graded;
    return summary;
}
