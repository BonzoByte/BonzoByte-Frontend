import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { distinctUntilChanged, map, Subscription } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import { SandboxMembershipPreview, SandboxMembershipPreviewService } from '../core/services/sandbox-membership-preview.service';
import { expireMembership, membershipTier } from '../core/helpers/membership';
import { Entitlements } from '../core/models/user.model';

@Component({
    selector: 'app-sandbox-membership-preview', standalone: true, imports: [CommonModule, TranslateModule],
    template: `<details class="bb-sandbox-membership">
      <summary>{{ 'sandboxMembership.title' | translate }}</summary>
      <p>{{ 'sandboxMembership.notice' | translate }}</p>
      <p *ngIf="loading">{{ 'common.loading' | translate }}</p>
      <ng-container *ngIf="preview as p">
        <p *ngIf="p.state === 'unavailable'">{{ 'sandboxMembership.requiresPayment' | translate }}</p>
        <div class="bb-preview-tiers">
          <span>{{ 'sandboxMembership.actual' | translate }}: <strong>{{ 'membership.' + actualTier | translate }}</strong></span>
          <span *ngIf="p.state === 'active' || p.state === 'expired'">{{ 'sandboxMembership.simulated' | translate }}:
            <strong class="bb-preview-tier">{{ 'membership.' + simulatedTier | translate }}</strong></span>
        </div>
        <p *ngIf="isActive" class="bb-preview-countdown">{{ 'sandboxMembership.remaining' | translate:{time: remainingText} }}</p>
        <p *ngIf="p.state === 'expired' || (p.state === 'active' && !isActive)" role="status">{{ 'sandboxMembership.expired' | translate }}</p>
        <button *ngIf="p.state === 'ready'" type="button" class="oauth-btn" (click)="start()"
          [disabled]="busy || loading || checkoutBusy">{{ (busy ? 'common.loading' : 'sandboxMembership.start') | translate }}</button>
      </ng-container>
      <p *ngIf="failed" role="status">{{ 'sandboxMembership.failed' | translate }}</p>
      <button *ngIf="failed" type="button" class="oauth-btn" (click)="refresh()"
        [disabled]="busy || loading || checkoutBusy">{{ 'sandboxMembership.refresh' | translate }}</button>
    </details>`,
    styles: [`:host { display: block; margin-top: 10px; }
      .bb-sandbox-membership { border: 1px dashed var(--bb-control-border); border-radius: 9px; padding: 9px 10px; }
      summary { cursor: pointer; font-size: 12px; font-weight: 700; }
      p { font-size: 12px; line-height: 1.4; color: var(--bb-text-muted); margin: 8px 0; }
      .bb-preview-tiers { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; margin: 8px 0; }
      .bb-preview-tier, .bb-preview-countdown { color: var(--bb-theme-accent); }
      .bb-preview-countdown { font-variant-numeric: tabular-nums; }
      button { max-width: 100%; white-space: normal; }
      summary:focus-visible { outline: 2px solid var(--bb-theme-accent); outline-offset: 3px; }`],
})
export class SandboxMembershipPreviewComponent implements OnInit, OnDestroy {
    @Input() checkoutBusy = false;
    preview: SandboxMembershipPreview | null = null;
    loading = false; busy = false; failed = false;
    private subscriptions = new Subscription();
    private request?: Subscription;
    private timer?: ReturnType<typeof setInterval>;
    private revision = 0;
    private receivedWall = 0; private receivedMonotonic = 0; private serverTime = 0;
    private nowMs = 0;
    private refreshedExpiry = false;
    private lastRefresh = 0;
    private readonly focused = () => {
        this.tick();
        if (document.visibilityState === 'visible' && Date.now() - this.lastRefresh > 2000) this.refresh();
    };
    constructor(private auth: AuthService, private api: SandboxMembershipPreviewService,
        private regional: RegionalSettingsService) {}
    ngOnInit(): void {
        this.subscriptions.add(this.auth.user$.pipe(
            map(user => `${user?._id ?? ''}:${!!user?.isVerified}`), distinctUntilChanged(),
        ).subscribe(() => {
            ++this.revision; this.request?.unsubscribe(); this.preview = null;
            this.loading = false; this.busy = false; this.failed = false;
            if (this.auth.getUser()?.isVerified) this.refresh();
        }));
        this.timer = setInterval(() => this.tick(), 1000);
        window.addEventListener('focus', this.focused);
        document.addEventListener('visibilitychange', this.focused);
    }
    get isActive(): boolean { return this.preview?.state === 'active' && this.remainingMs > 0; }
    private get remainingMs(): number { return Math.max(0, Date.parse(this.preview?.endsAt ?? '') - this.nowMs) || 0; }
    get remainingText(): string {
        const seconds = Math.ceil(this.remainingMs / 1000);
        return new Intl.NumberFormat(this.regional.locale(), { useGrouping: false }).format(Math.floor(seconds / 60))
            + ':' + new Intl.NumberFormat(this.regional.locale(), { useGrouping: false, minimumIntegerDigits: 2 }).format(seconds % 60);
    }
    private tier(entitlements: Entitlements | undefined): string {
        if (!entitlements) return 'standard';
        return membershipTier(expireMembership({ name: '', email: '', isAdmin: !!this.auth.getUser()?.isAdmin,
            entitlements }, this.nowMs));
    }
    get actualTier(): string { return this.tier(this.preview?.actual); }
    get simulatedTier(): string { return this.tier(this.isActive ? this.preview?.simulated : this.preview?.actual); }
    private accept(data: SandboxMembershipPreview): void {
        if (data?.sandbox !== true || data.realMembershipChanged !== false || !Number.isFinite(Date.parse(data.serverNow))
            || !data.actual || !data.simulated || !['unavailable', 'ready', 'active', 'expired'].includes(data.state)
            || (data.state === 'active' && (!Number.isFinite(Date.parse(data.endsAt ?? '')) || data.durationSeconds !== 300))) {
            this.failed = true; this.preview = null; return;
        }
        this.preview = data; this.failed = false;
        this.receivedWall = Date.now(); this.receivedMonotonic = performance.now();
        this.serverTime = this.nowMs = Date.parse(data.serverNow); this.refreshedExpiry = false;
    }
    private tick(): void {
        if (!this.preview) return;
        // A changed local clock must not extend the countdown; focus/wake rechecks the server.
        this.nowMs = Math.max(this.nowMs, this.serverTime + Math.max(0,
            Date.now() - this.receivedWall, performance.now() - this.receivedMonotonic));
        if (this.preview.state === 'active' && !this.isActive && !this.refreshedExpiry) {
            this.refreshedExpiry = true; this.refresh();
        }
    }
    refresh(): void {
        const user = this.auth.getUser();
        if (!user?._id || !user.isVerified || this.busy || this.loading || this.checkoutBusy) return;
        this.request?.unsubscribe(); const revision = ++this.revision;
        this.loading = true; this.lastRefresh = Date.now();
        this.request = this.api.status().subscribe({
            next: data => { if (revision === this.revision && this.auth.getUser()?._id === user._id) this.accept(data); },
            error: () => { if (revision === this.revision) { this.loading = false; this.failed = true; } },
            complete: () => { if (revision === this.revision) this.loading = false; },
        });
    }
    start(): void {
        const user = this.auth.getUser(); const orderId = this.preview?.orderId;
        if (!user?._id || !user.isVerified || !orderId || this.preview?.state !== 'ready' || this.busy || this.loading || this.checkoutBusy) return;
        this.request?.unsubscribe(); const revision = ++this.revision;
        this.busy = true; this.failed = false;
        this.request = this.api.start(orderId).subscribe({
            next: data => { if (revision === this.revision && this.auth.getUser()?._id === user._id) this.accept(data); },
            error: () => { if (revision === this.revision) { this.busy = false; this.failed = true; } },
            complete: () => { if (revision === this.revision) this.busy = false; },
        });
    }
    ngOnDestroy(): void {
        ++this.revision; this.request?.unsubscribe(); this.subscriptions.unsubscribe();
        if (this.timer) clearInterval(this.timer);
        window.removeEventListener('focus', this.focused);
        document.removeEventListener('visibilitychange', this.focused);
    }
}
