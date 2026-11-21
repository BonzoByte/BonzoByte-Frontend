export interface CommunityReplyDraft {
  schema: 1; body: string; replyToId: string | null; requestId: string | null; updatedAt: number;
}
type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
export const COMMUNITY_DRAFT_PREFIX = 'bonzobyte.community.reply-draft.v1.';
export const COMMUNITY_DRAFT_TTL = 30 * 24 * 60 * 60 * 1000;
const objectId = /^[a-f0-9]{24}$/i;
const requestId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Local plaintext drafts only. No tokens, emails, quote bodies or network calls. */
export class CommunityReplyDraftStore {
  constructor(private storage: () => BrowserStorage | null, private now = () => Date.now()) {}
  private key(owner: string, topic: number): string | null {
    return objectId.test(owner) && Number.isSafeInteger(topic) && topic > 0
      ? COMMUNITY_DRAFT_PREFIX + owner.toLowerCase() + '.' + topic : null;
  }
  private parse(raw: string | null): CommunityReplyDraft | null {
    if (!raw || raw.length > 200000) return null;
    try {
      const row = JSON.parse(raw);
      if (!row || typeof row !== 'object' || Array.isArray(row) || row.schema !== 1
        || Object.keys(row).some(key => !['schema','body','replyToId','requestId','updatedAt'].includes(key))
        || typeof row.body !== 'string' || row.body.length > 32000
        || !(row.replyToId === null || typeof row.replyToId === 'string' && objectId.test(row.replyToId))
        || !(row.requestId === null || typeof row.requestId === 'string' && requestId.test(row.requestId))
        || !Number.isSafeInteger(row.updatedAt) || row.updatedAt < 0 || row.updatedAt > this.now() + 300000
        || this.now() - row.updatedAt > COMMUNITY_DRAFT_TTL) return null;
      return row;
    } catch { return null; }
  }
  load(owner: string, topic: number): { draft: CommunityReplyDraft | null; available: boolean } {
    const key = this.key(owner, topic); if (!key) return { draft: null, available: true };
    try {
      const storage = this.storage(); if (!storage) return { draft: null, available: false };
      const raw = storage.getItem(key), draft = this.parse(raw);
      if (raw !== null && !draft) storage.removeItem(key);
      return { draft, available: true };
    } catch { return { draft: null, available: false }; }
  }
  save(owner: string, topic: number, input: Pick<CommunityReplyDraft, 'body' | 'replyToId' | 'requestId'>): boolean {
    const key = this.key(owner, topic); if (!key) return false;
    if (!input.body.trim() && !input.replyToId) return this.clear(owner, topic);
    const value: CommunityReplyDraft = { schema: 1, ...input, updatedAt: this.now() };
    if (!this.parse(JSON.stringify(value))) return false;
    try {
      const storage = this.storage(); if (!storage) return false;
      const prefix = COMMUNITY_DRAFT_PREFIX + owner.toLowerCase() + '.', keys: string[] = [];
      for (let i = 0; i < storage.length; i++) { const item = storage.key(i); if (item?.startsWith(prefix)) keys.push(item); }
      let retained = 0;
      for (const item of keys) {
        if (!this.parse(storage.getItem(item))) storage.removeItem(item); else retained++;
      }
      // Never silently evict another unfinished reply. Warn instead if the local store is full.
      if (storage.getItem(key) === null && retained >= 32) return false;
      storage.setItem(key, JSON.stringify(value)); return true;
    } catch { return false; }
  }
  clear(owner: string, topic: number, expectedRequestId?: string): boolean {
    const key = this.key(owner, topic); if (!key) return false;
    try {
      const storage = this.storage(); if (!storage) return false;
      const current = this.parse(storage.getItem(key));
      // A completed POST must not erase a newer draft written in another tab.
      if (expectedRequestId && current && current.requestId !== expectedRequestId) return true;
      storage.removeItem(key); return true;
    } catch { return false; }
  }
}
