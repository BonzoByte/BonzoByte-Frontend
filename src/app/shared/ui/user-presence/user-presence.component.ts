import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { UserPresenceService } from '../../../core/services/user-presence.service';

@Component({ selector: 'app-user-presence', standalone: true, imports: [CommonModule, TranslateModule], changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<span *ngIf="enabled && presence.status(userId) !== null" class="presence-dot" [class.online]="presence.status(userId) === true"
      role="img" [attr.aria-label]="(presence.status(userId) ? 'presence.online' : 'presence.offline') | translate"
      [title]="(presence.status(userId) ? 'presence.online' : 'presence.offline') | translate"></span>`,
    styles: [`:host{position:absolute;right:-2px;bottom:-2px;display:inline-flex;width:12px;height:12px;pointer-events:auto}
      .presence-dot{display:block;box-sizing:border-box;width:12px;height:12px;border-radius:50%;border:2px solid var(--bb-surface-1,#151c22);background:#858c95}
      .presence-dot.online{background:#22b865}`] })
export class UserPresenceComponent implements OnChanges, OnDestroy {
    @Input() userId: string | null | undefined;
    @Input() matchTPId?: number;
    @Input() conversationId?: string;
    @Input() enabled = true;
    private release?: () => void;
    constructor(readonly presence: UserPresenceService) {}
    ngOnChanges(): void { this.release?.(); this.release = this.enabled ? this.presence.watch(this.userId, this.matchTPId, this.conversationId) : undefined; }
    ngOnDestroy(): void { this.release?.(); }
}
