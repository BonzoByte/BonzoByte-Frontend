export type MatchLinkView = 'details' | 'discussion';

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
