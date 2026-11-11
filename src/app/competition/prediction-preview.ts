import type { CompetitionMine, CompetitionPick } from '../core/services/competition.service';
import { predictionPreviewIdentities } from './prediction-preview-identities';
import { localUiPreviewAllowed } from '../core/helpers/local-ui-preview';
import { predictionPreviewMatch } from './prediction-preview-metadata';

/** Display fixtures are never enabled in deployed builds, billing lab or LAN previews. */
export function predictionPreviewAllowed(config: { production: boolean; billingLab: boolean }, hostname: string): boolean {
    return localUiPreviewAllowed(config, hostname);
}

const HOUR = 3600000;
const statuses = ['pending', 'pending', 'won', 'lost', 'void', 'won', 'lost', 'won', 'lost',
    'won', 'won', 'void', 'lost', 'won', 'lost', 'won', 'won', 'lost'] as const;
const round = (value: number) => Math.round(value * 100) / 100;

/** Pure, repeatable UI examples. Negative IDs must never be used for real match lookups. */
export function createPredictionPreview(month: string, reference = new Date()): CompetitionMine {
    const entries: CompetitionPick[] = [];
    const validMonth = /^20\d{2}-(0[1-9]|1[0-2])$/.test(month);
    if (validMonth && Number.isFinite(reference.getTime()) && month <= reference.toISOString().slice(0, 7)) {
        const start = Date.parse(`${month}-01T00:00:00Z`);
        const end = Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1);
        // At most four submissions per UTC day; settled examples always precede now.
        const latest = Math.floor((Math.min(reference.getTime(), end) - 3 * HOUR) / (6 * HOUR)) * 6 * HOUR;
        for (let i = 0; i < statuses.length; i++) {
            const submitted = latest - i * 6 * HOUR;
            if (submitted < start) break;
            const side = i % 2;
            const price = [1.72, 2.30, 1.86, 2.10, 1.65, 2.55][i % 6];
            const status = statuses[i];
            const matchTPId = -(i + 1);
            const identity = predictionPreviewIdentities[i];
            entries.push({ matchTPId, side, month, submittedAt: new Date(submitted).toISOString(),
                snapshot: { matchTPId, tournament: identity.tournament,
                    startAt: new Date(submitted + HOUR).toISOString(), lockAt: new Date(submitted + HOUR - 5 * 60000).toISOString(),
                    players: identity.players.map((player, offset) => ({ ...player, id: -(i * 2 + offset + 1) })),
                    odds: side === 0 ? [price, 1.90] : [1.90, price], bookmakers: 5, model: null },
                settlement: status === 'pending' ? null : { status, units: status === 'won' ? round(price - 1) : status === 'lost' ? -1 : 0,
                    reason: 'ui-preview-only', settledAt: new Date(submitted + 2 * HOUR).toISOString() } });
        }
    }
    entries.forEach((pick, index) => pick.previewMatch = predictionPreviewMatch(pick, predictionPreviewIdentities[index].sourceMatchId));
    const settled = entries.filter(pick => pick.settlement && pick.settlement.status !== 'void').length;
    const won = entries.filter(pick => pick.settlement?.status === 'won').length;
    const units = round(entries.reduce((total, pick) => total + (pick.settlement?.units || 0), 0));
    const today = Number.isFinite(reference.getTime()) ? reference.toISOString().slice(0, 10) : '';
    return { month, entries, demo: true, remainingToday: 5 - entries.filter(pick => pick.submittedAt.startsWith(today)).length,
        summary: { submitted: entries.length, settled, won, units, pending: entries.filter(pick => !pick.settlement).length,
            voided: entries.filter(pick => pick.settlement?.status === 'void').length,
            roi: settled ? 100 * units / settled : null, hitRate: settled ? 100 * won / settled : null, qualified: settled >= 30,
            // Do not manufacture evidence about BonzoByte or market performance.
            comparison: { count: 0, userUnits: 0, modelUnits: 0, marketUnits: 0 } } };
}
