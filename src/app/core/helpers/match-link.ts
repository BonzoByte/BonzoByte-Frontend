export type MatchLinkView = 'details' | 'discussion';

export function tennisTodayTarget(query?: {getAll(key: string): string[]}) {
    const days = query?.getAll('day') || [], ids = query?.getAll('fixture') || [];
    if (days.length !== 1 || ids.length !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(days[0])) return null;
    const date = Date.parse(days[0] + 'T12:00:00Z'), id = parseMatchLinkId(ids[0]);
    return id && Number.isFinite(date) && new Date(date).toISOString().slice(0,10) === days[0] ? {day:days[0], id} : null;
}

/** Only stable public match identifiers belong in a shared URL. */
export function parseMatchLinkId(value: unknown): number | null {
    if (typeof value !== 'number' && (typeof value !== 'string' || !/^[1-9]\d{0,15}$/.test(value))) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function buildMatchLink(baseUri: string, matchId: unknown, view: MatchLinkView = 'details'): string | null {
    const id = parseMatchLinkId(matchId);
    if (id === null) return null;
    try {
        const base = new URL(baseUri);
        if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) return null;
        // document.baseURI honours Angular's deployment subdirectory. Never copy
        // the current query, fragment, authentication state or private filters.
        // Explicit namespace: a canonical MatchId must never be guessed as a TPId.
        const link = new URL(`matches/id/${id}`, base);
        if (view === 'discussion') link.searchParams.set('view', 'discussion');
        return link.href;
    } catch { return null; }
}
