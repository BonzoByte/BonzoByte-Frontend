import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, Injector, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { buildCommentLink, CommentLinkTarget, parseCommentLinkTarget } from '../core/helpers/comment-link';
import { parseMatchLinkId } from '../core/helpers/match-link';
import { MatchLinksService } from '../core/services/match-links.service';
import { ClipboardService } from '../core/services/clipboard.service';
import { LocalizedSnackbarService } from '../core/i18n/localized-snackbar.service';

/** One lazy canonical lookup per open thread, not one request for every comment. */
@Injectable()
export class CommentLinkCopyService implements OnDestroy {
    readonly busy = signal(false);
    readonly failed = signal(false);
    readonly manualLink = signal<string | null>(null);
    readonly targetId = signal<string | null>(null);
    private matchTPId = 0;
    private canonicalId: number | null = null;
    private revision = 0;
    private request?: Subscription;
    constructor(@Inject(DOCUMENT) private document: Document, private injector: Injector) {}
    reset(matchTPId: number, matchId?: number | null): void {
        this.revision++; this.request?.unsubscribe(); this.matchTPId = matchTPId;
        this.canonicalId = parseMatchLinkId(matchId);
        this.busy.set(false); this.failed.set(false); this.manualLink.set(null); this.targetId.set(null);
    }
    copy(target: CommentLinkTarget, stillVisible: () => boolean): void {
        const reference = parseCommentLinkTarget(target?.id, target?.sequence);
        if (this.busy() || !reference || parseMatchLinkId(this.matchTPId) === null || !stillVisible()) return;
        const revision = ++this.revision;
        this.busy.set(true); this.failed.set(false); this.manualLink.set(null); this.targetId.set(reference.id);
        const current = () => revision === this.revision && stillVisible();
        if (this.canonicalId !== null) { void this.write(reference, revision, current); return; }
        this.request = this.injector.get(MatchLinksService).byLegacyTPId(this.matchTPId).subscribe({
            next: row => {
                if (revision !== this.revision) return;
                if (!current()) { this.busy.set(false); return; }
                if (row.matchTPId !== this.matchTPId || parseMatchLinkId(row.matchId) === null) { this.fail(revision); return; }
                this.canonicalId = row.matchId!; void this.write(reference, revision, current);
            }, error: () => this.fail(revision),
        });
    }
    private fail(revision: number): void {
        if (revision === this.revision) { this.failed.set(true); this.busy.set(false); }
    }
    private async write(target: CommentLinkTarget, revision: number, current: () => boolean): Promise<void> {
        try {
            const link = buildCommentLink(this.document.baseURI, this.canonicalId, target);
            if (!link) { this.fail(revision); return; }
            if (!current()) return;
            const copied = await this.injector.get(ClipboardService).copy(link);
            if (!current()) return;
            if (copied === 'copied') this.injector.get(LocalizedSnackbarService).open('commentLink.copied', '', { duration: 3000, panelClass: 'success-snackbar' });
            else this.manualLink.set(link);
        } catch { if (current()) this.failed.set(true); }
        finally { if (revision === this.revision) this.busy.set(false); }
    }
    ngOnDestroy(): void { this.revision++; this.request?.unsubscribe(); }
}
