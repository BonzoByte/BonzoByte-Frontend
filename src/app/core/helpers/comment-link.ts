import { buildMatchLink, parseMatchLinkId } from './match-link';

export interface CommentLinkTarget { id: string; sequence: number; }

/** Public identifiers only: the sequence selects one bounded page, never content or permissions. */
export function parseCommentLinkTarget(id: unknown, sequence: unknown): CommentLinkTarget | null {
    const position = parseMatchLinkId(sequence);
    return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id) && position !== null
        ? { id: id.toLowerCase(), sequence: position } : null;
}

export function buildCommentLink(baseUri: string, matchId: unknown, target: CommentLinkTarget): string | null {
    const comment = parseCommentLinkTarget(target?.id, target?.sequence);
    const match = buildMatchLink(baseUri, matchId, 'discussion');
    if (!comment || !match) return null;
    const link = new URL(match);
    link.searchParams.set('comment', comment.id);
    link.searchParams.set('sequence', String(comment.sequence));
    return link.href;
}
