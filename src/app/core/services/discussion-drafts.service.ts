import { Inject, Injectable, OnDestroy, Optional, signal } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { DiscussionsService } from './discussions.service';
import { discussionLengthValid } from '../helpers/discussion-text';
import { DraftUnloadGuardService } from './draft-unload-guard.service';

export interface DiscussionDraftReply { id: string; authorName: string; }
export interface DiscussionDraft {
  body: string;
  reply: DiscussionDraftReply | null;
  clientRequestId?: string;
}
export interface DiscussionDraftUndoToken { readonly id: number; readonly actor: string; readonly matchTPId: number; }

/** Tab-memory only: no browser storage, timers, network, analytics or auto-send. */
@Injectable({ providedIn: 'root' })
export class DiscussionDraftsService implements OnDestroy {
  private readonly entries = new Map<string, DiscussionDraft>();
  private readonly undoState = signal<DiscussionDraftUndoToken | null>(null);
  readonly pendingUndo = this.undoState.asReadonly();
  readonly undoEnded = new Subject<DiscussionDraftUndoToken>();
  readonly restored = new Subject<DiscussionDraftUndoToken>();
  private undoSequence = 0;
  private discarded?: { token: DiscussionDraftUndoToken; key: string; draft: DiscussionDraft };
  private destroyed = false;
  private readonly accountSubscription: Subscription;
  private readonly releaseUnload?: () => void;
  constructor(private api: DiscussionsService,
    @Optional() @Inject(DraftUnloadGuardService) private unload: DraftUnloadGuardService | null = null) {
    this.releaseUnload = unload?.register(() => this.entries.size > 0);
    this.accountSubscription = api.accountChanged.subscribe(() => { this.entries.clear(); this.expireUndo(); this.unload?.refresh(); });
  }
  private key(actor: string, matchTPId: number): string | null {
    return !this.destroyed && actor && actor === this.api.user()?._id && this.api.canCompose && Number.isSafeInteger(matchTPId) && matchTPId > 0
      ? JSON.stringify([actor, matchTPId]) : null;
  }
  read(actor: string, matchTPId: number): DiscussionDraft | null {
    const key = this.key(actor, matchTPId), value = key && this.entries.get(key);
    return value ? { ...value, reply: value.reply ? { ...value.reply } : null } : null;
  }
  save(actor: string, matchTPId: number, body: string, reply: DiscussionDraftReply | null): void {
    const key = this.key(actor, matchTPId);
    if (!key || typeof body !== 'string') return;
    this.edited(actor, matchTPId);
    if (!discussionLengthValid(body)) return;
    if (!body.trim()) { this.entries.delete(key); this.unload?.refresh(); return; }
    const previous = this.entries.get(key);
    const samePost = previous?.body.trim() === body.trim() && previous?.reply?.id === reply?.id;
    this.entries.set(key, { body, reply: reply ? { id: reply.id, authorName: reply.authorName } : null,
      ...(samePost && previous?.clientRequestId ? { clientRequestId: previous.clientRequestId } : {}) });
    this.unload?.refresh();
  }
  beginSubmission(actor: string, matchTPId: number, body: string, reply: DiscussionDraftReply | null): string | null {
    const key = this.key(actor, matchTPId);
    if (!key || !body.trim() || !discussionLengthValid(body)) return null;
    this.save(actor, matchTPId, body, reply);
    const draft = this.entries.get(key)!;
    return draft.clientRequestId ??= crypto.randomUUID();
  }
  confirmed(actor: string, matchTPId: number, body: string, replyToId: string | undefined, clientRequestId: string): void {
    const key = this.key(actor, matchTPId), draft = key && this.entries.get(key);
    if (key && draft && draft.body.trim() === body && draft.reply?.id === replyToId && draft.clientRequestId === clientRequestId)
      this.entries.delete(key);
    const pending = this.discarded;
    if (key && pending?.key === key && pending.draft.body.trim() === body && pending.draft.reply?.id === replyToId
        && pending.draft.clientRequestId === clientRequestId) this.expireUndo(pending.token);
    this.unload?.refresh();
  }
  discard(actor: string, matchTPId: number): void {
    const key = this.key(actor, matchTPId); if (key) { this.entries.delete(key); this.edited(actor, matchTPId); this.unload?.refresh(); }
  }
  /** Only the draft actually displayed may be discarded; never delete a newer composer. */
  discardWithUndo(actor: string, matchTPId: number, body: string, reply: DiscussionDraftReply | null): DiscussionDraftUndoToken | null {
    const key = this.key(actor, matchTPId), draft = key && this.entries.get(key);
    if (!key || !draft || draft.body !== body || draft.reply?.id !== reply?.id) return null;
    this.expireUndo();
    const token = Object.freeze({ id: ++this.undoSequence, actor, matchTPId });
    this.discarded = { token, key, draft: { ...draft, reply: draft.reply ? { ...draft.reply } : null } };
    this.entries.delete(key); this.undoState.set(token); this.unload?.refresh(); return token;
  }
  edited(actor: string, matchTPId: number): void {
    if (this.discarded?.token.actor === actor && this.discarded.token.matchTPId === matchTPId) this.expireUndo();
  }
  restoreDiscarded(token: DiscussionDraftUndoToken): boolean {
    const pending = this.discarded, key = this.key(token.actor, token.matchTPId);
    if (!pending || pending.token !== token || !key || pending.key !== key || this.entries.has(key)) return false;
    this.entries.set(key, pending.draft);
    this.unload?.refresh();
    this.expireUndo(token); this.restored.next(token); return true;
  }
  expireUndo(token?: DiscussionDraftUndoToken): void {
    if (!this.discarded || (token && this.discarded.token !== token)) return;
    const ended = this.discarded.token;
    this.discarded = undefined; this.undoState.set(null); this.undoEnded.next(ended);
  }
  ngOnDestroy(): void {
    this.destroyed = true; this.accountSubscription.unsubscribe(); this.entries.clear(); this.expireUndo();
    this.releaseUnload?.();
    this.undoEnded.complete(); this.restored.complete();
  }
}
