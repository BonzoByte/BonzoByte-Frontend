import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/** Fictional first-party creatives. No SDK, links, timers or tracking. */
@Component({
    selector: 'app-demo-ad',
    standalone: true,
    imports: [TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './demo-ad.component.html',
    styleUrl: './demo-ad.component.scss',
})
export class DemoAdComponent {
    @Input() slot = 1;
    @Output() dismissed = new EventEmitter<void>();
    readonly brands = { equipment: 'BB FORM', court: 'BB CLAY', training: 'BB RALLY' } as const;
    get creative(): 'equipment' | 'court' | 'training' {
        const index = Number.isInteger(this.slot) && this.slot > 0 ? (this.slot - 1) % 3 : 0;
        return (['equipment', 'court', 'training'] as const)[index];
    }
}
