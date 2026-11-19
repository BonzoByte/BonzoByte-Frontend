import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ArchiveCoverageService } from '../../../core/services/archive-coverage.service';

@Component({
    selector: 'app-archive-coverage', standalone: true,
    imports: [CommonModule, TranslateModule], changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      <p *ngIf="coverage.coverage$ | async as scope" class="archive-coverage-note" role="note">
        {{ 'archiveCoverage.notice' | translate:{ from: date(scope.fromDate), through: date(scope.through) } }}
      </p>`,
    styles: [`
      :host { display: block; }
      .archive-coverage-note { margin: 6px 12px; padding: 7px 10px; border: 1px solid var(--bb-border, #40505b);
        border-radius: 7px; background: var(--bb-surface, #18232bd9); color: var(--bb-text-muted, #b3c0cc);
        font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
    `]
})
export class ArchiveCoverageComponent {
    readonly coverage = inject(ArchiveCoverageService);
    private readonly translate = inject(TranslateService);
    date(iso: string): string {
        const locale = this.translate.currentLang || this.translate.defaultLang || 'en';
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' })
            .format(new Date(iso + 'T12:00:00Z'));
    }
}
