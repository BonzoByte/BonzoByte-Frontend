import { Injectable, OnDestroy } from '@angular/core';
import { MatSnackBarRef } from '@angular/material/snack-bar';
import { Subscription, take } from 'rxjs';
import { LocalizedSnackbarComponent, LocalizedSnackbarService } from '../i18n/localized-snackbar.service';
import { DiscussionDraftReply, DiscussionDraftsService, DiscussionDraftUndoToken } from './discussion-drafts.service';

/** One opaque undo handle, expiring with the existing pausable toast; never holds draft text. */
@Injectable({ providedIn: 'root' })
export class DiscussionDraftUndoService implements OnDestroy {
  private active?: { token: DiscussionDraftUndoToken; ref: MatSnackBarRef<LocalizedSnackbarComponent>; subscriptions: Subscription };
  private readonly ended: Subscription;
  constructor(private drafts: DiscussionDraftsService, private snack: LocalizedSnackbarService) {
    this.ended = drafts.undoEnded.subscribe(token => this.finish(token));
  }
  discard(actor: string, matchTPId: number, body: string, reply: DiscussionDraftReply | null): void {
    const token = this.drafts.discardWithUndo(actor, matchTPId, body, reply);
    if (!token) return;
    try {
      const ref = this.snack.open('discussions.draftDiscarded', 'discussions.undoDraft',
        { duration: 10000 }, { undoId: token.id });
      const subscriptions = new Subscription(); this.active = { token, ref, subscriptions };
      subscriptions.add(ref.onAction().pipe(take(1)).subscribe(() => this.restoreToken(token)));
      subscriptions.add(ref.afterDismissed().pipe(take(1)).subscribe(() => this.finish(token, false)));
    } catch { this.finish(token); this.drafts.expireUndo(token); }
  }
  available(actor: string, matchTPId: number): boolean {
    const token = this.drafts.pendingUndo();
    return !!token && this.active?.token === token && token.actor === actor && token.matchTPId === matchTPId;
  }
  restore(actor: string, matchTPId: number): boolean {
    return this.available(actor, matchTPId) ? this.restoreToken(this.active!.token) : false;
  }
  private restoreToken(token: DiscussionDraftUndoToken): boolean {
    if (this.active?.token !== token) return false;
    const active = this.active; this.active = undefined; active.subscriptions.unsubscribe();
    const restored = this.drafts.restoreDiscarded(token);
    this.drafts.expireUndo(token); active.ref.dismiss();
    if (restored) this.snack.open('discussions.draftRestored', '', { duration: 3000, panelClass: 'success-snackbar' });
    return restored;
  }
  private finish(token: DiscussionDraftUndoToken, dismiss = true): void {
    if (this.active?.token !== token) return;
    const active = this.active; this.active = undefined; active.subscriptions.unsubscribe();
    this.drafts.expireUndo(token); if (dismiss) active.ref.dismiss();
  }
  ngOnDestroy(): void {
    if (this.active) this.finish(this.active.token);
    this.ended.unsubscribe();
  }
}
