import { CommonModule, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, HostListener, inject, NgZone, OnDestroy, OnInit, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ReadRecoveryService } from '../../../core/services/read-recovery.service';
import { NoticeCountdown } from '../../../core/i18n/notice-countdown';

@Component({ selector: 'app-connectivity-notice', standalone: true,
    imports: [CommonModule, TranslateModule], changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      <aside *ngIf="visible()" class="connectivity-notice" role="status" aria-live="polite">
        <div><strong>{{ titleKey() | translate }}</strong><span>{{ hintKey() | translate }}</span>
          <span>{{ 'viewRecovery.preserved' | translate }}</span>
          <button *ngIf="!offline() && recovery.hasFailure()" type="button" class="retry-read" (click)="recovery.retry()">{{ 'viewRecovery.retry' | translate }}</button>
        </div>
        <button type="button" class="dismiss-notice" [attr.aria-label]="'common.close' | translate" (click)="dismiss()">×</button>
      </aside>`,
    styles: [`
      :host { display: contents; }
      .connectivity-notice { position: fixed; top: calc(var(--header-h, 60px) + 8px); left: 50%; transform: translateX(-50%);
        z-index: 1500; width: min(520px, calc(100vw - 24px)); box-sizing: border-box; display: flex; align-items: center;
        gap: 14px; padding: 10px 12px; border: 1px solid var(--bb-border-strong, #657481); border-radius: 8px;
        background: var(--bb-surface-2, #202a33); color: var(--bb-text, #e8edf2); box-shadow: 0 3px 15px #0004;
        font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
      .connectivity-notice div { flex: 1; min-width: 0; } strong, span { display: block; }
      span { color: var(--bb-text-muted, #b3c0cc); }
      button { flex-shrink: 0; width: 32px; height: 32px; border: 0; border-radius: 5px; background: transparent;
        color: inherit; cursor: pointer; font: inherit; font-size: 22px; }
      button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
      .retry-read { width: auto; height: auto; margin-top: 6px; padding: 5px 10px; font-size: 12px;
        border: 1px solid var(--bb-border-strong, #657481); }
    `] })
export class ConnectivityNoticeComponent implements OnInit, OnDestroy {
    private readonly view = inject(DOCUMENT).defaultView;
    private readonly zone = inject(NgZone);
    private readonly element = inject(ElementRef<HTMLElement>);
    readonly recovery = inject(ReadRecoveryService);
    readonly offline = signal(this.view?.navigator.onLine === false);
    readonly dismissed = signal(false);
    readonly reconnected = signal(false);
    readonly visible = computed(() => !this.dismissed() && (this.offline() || this.reconnected() || this.recovery.hasFailure()));
    readonly titleKey = computed(() => this.offline() ? 'connection.offline' : this.recovery.hasFailure() ? 'viewRecovery.unavailable' : 'viewRecovery.backOnline');
    readonly hintKey = computed(() => this.offline() ? 'connection.hint' : this.recovery.hasFailure() ? 'viewRecovery.unavailableHint' : 'viewRecovery.backHint');
    private returnCountdown?: NoticeCountdown;
    private pointerInside = false;
    private focusInside = false;
    constructor() { effect(() => { this.recovery.failureEpisode(); this.dismissed.set(false); }); }
    private readonly onOffline = () => this.zone.run(() => {
        this.returnCountdown?.dispose(); this.reconnected.set(false);
        if (!this.offline()) { this.dismissed.set(false); this.offline.set(true); }
    });
    private readonly onOnline = () => this.zone.run(() => {
        if (!this.offline()) return;
        this.offline.set(false); this.dismissed.set(false); this.reconnected.set(true);
        this.zone.runOutsideAngular(() => {
            this.returnCountdown?.dispose();
            this.returnCountdown = new NoticeCountdown(6000, () => this.zone.run(() => this.reconnected.set(false)));
            if (this.pointerInside) this.returnCountdown.pause('pointer');
            if (this.focusInside) this.returnCountdown.pause('focus');
            this.returnCountdown.start();
        });
    });

    @HostListener('mouseenter') pausePointer(): void { this.pointerInside = true; this.returnCountdown?.pause('pointer'); }
    @HostListener('mouseleave') resumePointer(): void { this.pointerInside = false; this.returnCountdown?.resume('pointer'); }
    @HostListener('focusin') pauseFocus(): void { this.focusInside = true; this.returnCountdown?.pause('focus'); }
    @HostListener('focusout', ['$event']) resumeFocus(event: FocusEvent): void {
        if (this.element.nativeElement.contains(event.relatedTarget as Node | null)) return;
        this.focusInside = false; this.returnCountdown?.resume('focus');
    }

    dismiss(): void {
        this.dismissed.set(true); this.reconnected.set(false);
        this.pointerInside = false; this.focusInside = false;
        this.returnCountdown?.dispose();
    }

    ngOnInit(): void {
        this.zone.runOutsideAngular(() => {
            this.view?.addEventListener('offline', this.onOffline);
            this.view?.addEventListener('online', this.onOnline);
        });
    }
    ngOnDestroy(): void {
        this.returnCountdown?.dispose();
        this.view?.removeEventListener('offline', this.onOffline);
        this.view?.removeEventListener('online', this.onOnline);
    }
}
