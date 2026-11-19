import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ArchiveCoverageService } from '../../../core/services/archive-coverage.service';
import { ArchiveCoveragePreferenceService } from '../../../core/services/archive-coverage-preference.service';

@Component({
    selector: 'app-archive-coverage', standalone: true,
    imports: [CommonModule, TranslateModule], changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      <ng-container *ngIf="preference.isVisible">
        <p *ngIf="coverage.coverage$ | async as scope" class="archive-coverage-note" role="note">
          <span>{{ 'archiveCoverage.notice' | translate:{ from: date(scope.fromDate), through: date(scope.through) } }}</span>
          <button type="button" class="archive-coverage-close" (click)="preference.dismiss()"
            [attr.aria-label]="'common.close' | translate" [title]="'common.close' | translate">×</button>
        </p>
      </ng-container>`,
    styles: [`
      :host { display: block; }
      .archive-coverage-note { margin: 6px 12px; padding: 7px 10px; border: 1px solid var(--bb-border, #40505b);
        border-radius: 7px; background: var(--bb-surface, #18232bd9); color: var(--bb-text-muted, #b3c0cc);
        font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; display: flex; align-items: flex-start; gap: 10px; }
      .archive-coverage-note > span { flex: 1; min-width: 0; }
      .archive-coverage-close { flex: 0 0 20px; width: 20px; height: 20px; margin: -1px -3px -1px 0;
        padding: 0; border: 0; border-radius: 3px; background: transparent; color: inherit;
        font: inherit; font-size: 17px; line-height: 20px; cursor: pointer; }
      .archive-coverage-close:hover { color: var(--bb-text, #fff); }
      .archive-coverage-close:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
    `]
})
export class ArchiveCoverageComponent {
    readonly coverage = inject(ArchiveCoverageService);
    readonly preference = inject(ArchiveCoveragePreferenceService);
    private readonly translate = inject(TranslateService);
    date(iso: string): string {
        const locale = this.translate.currentLang || this.translate.defaultLang || 'en';
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' })
            .format(new Date(iso + 'T12:00:00Z'));
    }
}
