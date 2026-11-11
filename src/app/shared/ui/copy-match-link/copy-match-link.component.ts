import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject, Input, OnChanges, OnDestroy } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { buildMatchLink, MatchLinkView, parseMatchLinkId } from '../../../core/helpers/match-link';
import { MatchLinksService } from '../../../core/services/match-links.service';
import { LocalizedSnackbarService } from '../../../core/i18n/localized-snackbar.service';
import { ClipboardService } from '../../../core/services/clipboard.service';
import { ManualCopyComponent } from '../manual-copy/manual-copy.component';

@Component({
    selector: 'app-copy-match-link', standalone: true, imports: [CommonModule, TranslateModule, ManualCopyComponent],
    template: `<div class="match-link-tools" *ngIf="validTarget">
      <button type="button" class="bb-btn match-link-button" (click)="copy()" [disabled]="busy || !link"
        [attr.aria-busy]="busy"
        [attr.aria-label]="'matchLink.copy' | translate" [title]="'matchLink.copy' | translate">
        <span class="bi bi-link-45deg" aria-hidden="true"></span> {{ 'matchLink.copy' | translate }}
      </button>
      <span class="match-link-status" role="status" aria-live="polite">{{ (resolving ? 'matchLink.preparing' : prepareFailed ? 'matchLink.prepareFailed' : '') | translate }}</span>
      <button *ngIf="prepareFailed" type="button" class="bb-btn" (click)="resolve()">{{ 'discussions.retry' | translate }}</button>
      <app-manual-copy *ngIf="manual && link" class="match-link-manual" [value]="link!"
        [label]="'matchLink.manual' | translate" [accessibleLabel]="'matchLink.copy' | translate" />
    </div>`,
    styles: [`:host { display: block; margin: 0 0 12px; }
      .match-link-tools { display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 6px 10px; }
      .match-link-button { display: inline-flex; align-items: center; gap: 5px; font: inherit; font-size: 12px; cursor: pointer; }
      .match-link-button:disabled { cursor: wait; } .match-link-status { font-size: 12px; }
      .match-link-status:empty { display: none; }
      .match-link-manual { flex-basis: 100%; min-width: 0; font-size: 12px; }
      button:focus-visible { outline: 2px solid var(--bb-accent, #8edcff); outline-offset: 3px; }`],
})
export class CopyMatchLinkComponent implements OnChanges, OnDestroy {
    @Input({ required: true }) matchTPId!: number;
    @Input() matchId?: number | null;
    @Input() view: MatchLinkView = 'details';
    busy = false;
    copied = false;
    manual = false;
    resolving = false;
    prepareFailed = false;
    private canonicalId: number | null = null;
    private resolvedTPId: number | null = null;
    private request?: Subscription;
    private revision = 0;
    constructor(@Inject(DOCUMENT) private document: Document, private links: MatchLinksService,
        private snack: LocalizedSnackbarService, private clipboard: ClipboardService) {}
    get validTarget(): boolean { return parseMatchLinkId(this.matchTPId) !== null; }
    get link(): string | null { return this.validTarget ? buildMatchLink(this.document.baseURI, this.canonicalId, this.view) : null; }
    ngOnChanges(): void {
        this.revision++; this.request?.unsubscribe(); this.resolving = false;
        this.busy = this.copied = this.manual = this.prepareFailed = false;
        this.canonicalId = parseMatchLinkId(this.matchId) ?? (this.resolvedTPId === this.matchTPId ? this.canonicalId : null);
        this.resolvedTPId = this.matchTPId;
        if (this.validTarget && this.canonicalId === null) this.resolve();
    }
    resolve(): void {
        if (!this.validTarget) return;
        this.request?.unsubscribe(); const revision = ++this.revision;
        this.resolving = true; this.prepareFailed = false;
        this.request = this.links.byLegacyTPId(this.matchTPId).subscribe({
            next: row => {
                if (revision !== this.revision) return;
                this.canonicalId = parseMatchLinkId(row.matchId); this.resolving = false;
                this.prepareFailed = this.canonicalId === null;
            },
            error: () => { if (revision === this.revision) { this.resolving = false; this.prepareFailed = true; } },
        });
    }
    ngOnDestroy(): void { this.revision++; this.request?.unsubscribe(); }
    async copy(): Promise<void> {
        const link = this.link;
        if (!link || this.busy) return;
        const revision = this.revision;
        this.busy = true; this.copied = this.manual = false;
        try {
            const result = await this.clipboard.copy(link);
            if (revision === this.revision) {
                if (result === 'copied') {
                    this.copied = true;
                    this.snack.open('matchLink.copied', '', { duration: 3000, panelClass: 'success-snackbar' });
                } else this.manual = true;
            }
        } finally { if (revision === this.revision) this.busy = false; }
    }
}
