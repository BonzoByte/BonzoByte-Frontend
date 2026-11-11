import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { PUBLIC_CONTACT_EMAIL, PUBLIC_INFO_EMAIL } from '../../../core/config/contact';
import { LocalizedSnackbarService } from '../../../core/i18n/localized-snackbar.service';
import { ClipboardService } from '../../../core/services/clipboard.service';
import { ManualCopyComponent } from '../manual-copy/manual-copy.component';

/** Copies only the public address shown beside this button, never form input. */
@Component({
  selector: 'app-copy-contact-email', standalone: true, imports: [CommonModule, TranslateModule, ManualCopyComponent],
  host: { '[class.manual-copy-open]': 'manual' },
  template: `<button type="button" class="bb-copy-email" (click)="copy()" [disabled]="busy"
    [attr.aria-busy]="busy" [attr.aria-label]="'contact.copyEmail' | translate" [title]="'contact.copyEmail' | translate">
    <span class="bi bi-copy" aria-hidden="true"></span>
  </button>
  <app-manual-copy *ngIf="manual" [value]="email" [label]="'contact.copyEmailFailed' | translate"
    [accessibleLabel]="'contact.copyEmail' | translate" />`,
  styles: [`:host { display: inline-flex; flex: 0 0 auto; vertical-align: middle; }
    :host(.manual-copy-open) { display: flex; flex-basis: 100%; flex-direction: column;
      align-items: flex-start; gap: 4px; width: 100%; max-width: 100%; }
    app-manual-copy { width: 100%; font-size: 12px; }
    .bb-copy-email { display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; padding: 4px; border: 1px solid transparent; border-radius: 6px;
      font: inherit; color: var(--bb-text-muted); background: transparent; cursor: pointer; }
    .bb-copy-email:hover { color: var(--bb-theme-accent); background: var(--bb-surface-3); border-color: var(--bb-control-border); }
    .bb-copy-email:focus-visible { outline: 2px solid var(--bb-theme-accent); outline-offset: 2px; }
    .bb-copy-email:disabled { cursor: wait; opacity: .6; }`],
})
export class CopyContactEmailComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) email!: typeof PUBLIC_CONTACT_EMAIL | typeof PUBLIC_INFO_EMAIL;
  busy = false;
  manual = false;
  private destroyed = false;
  private revision = 0;
  constructor(private clipboard: ClipboardService, private snack: LocalizedSnackbarService) {}
  ngOnChanges(): void { this.revision++; this.busy = this.manual = false; }
  ngOnDestroy(): void { this.destroyed = true; this.revision++; }
  async copy(): Promise<void> {
    if (this.busy || this.destroyed || !this.email) return;
    const revision = this.revision;
    this.busy = true; this.manual = false;
    try {
      const result = await this.clipboard.copy(this.email);
      if (revision !== this.revision) return;
      if (result === 'copied') this.snack.open('contact.emailCopied', '', { duration: 3000, panelClass: 'success-snackbar' });
      else {
        this.manual = true;
        this.snack.open('contact.copyEmailFailed', '', { duration: 5000, panelClass: 'error-snackbar' });
      }
    } finally { if (revision === this.revision) this.busy = false; }
  }
}
