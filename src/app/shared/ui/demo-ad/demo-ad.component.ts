import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/** Fictional, deterministic local creatives. No SDK, links, timers or tracking. */
@Component({
    selector: 'app-demo-ad',
    standalone: true,
    imports: [TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <aside class="demo-ad" [attr.data-creative]="creative" [attr.aria-label]="'demoAds.label' | translate">
            <div class="demo-ad__label">
                <span>{{ 'demoAds.label' | translate }}</span>
                <div class="demo-ad__actions">
                    <span class="demo-ad__slot" aria-hidden="true">#{{ slot }}</span>
                    <button type="button" class="demo-ad__close"
                        [attr.aria-label]="'demoAds.remove' | translate" [title]="'demoAds.remove' | translate"
                        (click)="$event.stopPropagation(); dismissed.emit()">
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
            </div>
            <div class="demo-ad__creative">
                <div class="demo-ad__art" aria-hidden="true"><span class="demo-ad__court"></span><span class="demo-ad__ball"></span></div>
                <div class="demo-ad__copy">
                    <strong>{{ ('demoAds.creatives.' + creative + '.title') | translate }}</strong>
                    <p class="demo-ad__description">{{ ('demoAds.creatives.' + creative + '.body') | translate }}</p>
                </div>
            </div>
            <p class="demo-ad__disclaimer">{{ 'demoAds.note' | translate }}</p>
        </aside>
    `,
    styles: [`
        :host { display: block; min-width: 0; width: 100%; }
        .demo-ad {
            --demo-accent: #7dcfa4;
            box-sizing: border-box; min-height: 148px; padding: 8px 18px 12px;
            border: 1px solid var(--bb-border-strong, #56616b); border-radius: 9px;
            background: var(--bb-surface-2, #1b232b); color: var(--bb-text, #e8edf2);
            text-align: left; white-space: normal; overflow-wrap: anywhere;
        }
        .demo-ad[data-creative="court"] { --demo-accent: #e4b580; }
        .demo-ad[data-creative="training"] { --demo-accent: #91caff; }
        .demo-ad__label {
            display: flex; align-items: center; justify-content: space-between; gap: 8px;
            color: var(--bb-text-muted, #9ba8b5); font-size: 10px; font-weight: 600;
            letter-spacing: .08em; text-transform: uppercase; line-height: 1.4;
        }
        .demo-ad__slot { font-variant-numeric: tabular-nums; }
        .demo-ad__actions { display: flex; align-items: center; gap: 8px; }
        .demo-ad__close {
            display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
            width: 32px; height: 32px; padding: 0; border: 1px solid transparent; border-radius: 6px;
            background: transparent; color: var(--bb-text, #e8edf2); cursor: pointer;
            font: inherit; font-size: 22px; line-height: 1; letter-spacing: normal;
        }
        .demo-ad__close:hover { border-color: var(--bb-border-strong, #56616b); }
        .demo-ad__close:focus-visible { outline: 2px solid var(--bb-text, #e8edf2); outline-offset: 2px; }
        .demo-ad__creative { display: flex; align-items: center; gap: 18px; padding: 3px 0 10px; }
        .demo-ad__copy { min-width: 0; flex: 1; }
        .demo-ad__art {
            position: relative; flex: 0 0 80px; height: 56px; overflow: hidden;
            border-radius: 6px; background: #142e28; color: var(--demo-accent);
        }
        .demo-ad[data-creative="court"] .demo-ad__art { background: #433026; }
        .demo-ad[data-creative="training"] .demo-ad__art { background: #172d43; }
        .demo-ad__court { position: absolute; inset: 8px; border: 1px solid currentColor; }
        .demo-ad__court::before { content: ''; position: absolute; inset: 0 8px; border-inline: 1px solid currentColor; }
        .demo-ad__court::after { content: ''; position: absolute; inset: 50% 0 auto; border-top: 1px solid currentColor; }
        .demo-ad__ball { position: absolute; width: 13px; height: 13px; right: 16px; top: 13px; border: 1px solid #fff; border-radius: 50%; background: currentColor; }
        strong { display: block; margin: 0 0 4px; font-size: 16px; font-weight: 600; line-height: 1.3; }
        p { margin: 0; color: var(--bb-text-muted, #9ba8b5); font-size: 12px; line-height: 1.5; }
        .demo-ad__disclaimer { border-top: 1px solid var(--bb-border, #3a434b); padding-top: 7px; font-size: 10px; }
        @media (max-width: 600px) {
            .demo-ad { padding: 7px 12px 10px; }
            .demo-ad__creative { gap: 12px; }
            .demo-ad__art { flex-basis: 56px; height: 48px; }
            strong { font-size: 14px; }
        }
    `]
})
export class DemoAdComponent {
    @Input() slot = 1;
    @Output() dismissed = new EventEmitter<void>();
    get creative(): 'equipment' | 'court' | 'training' {
        const index = Number.isInteger(this.slot) && this.slot > 0 ? (this.slot - 1) % 3 : 0;
        return (['equipment', 'court', 'training'] as const)[index];
    }
}
