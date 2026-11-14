import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { PaypalButtons, PaypalSandboxService, SandboxConfig } from '../core/services/paypal-sandbox.service';
import { BILLING_PLANS } from '../core/config/billing-plans';
import { environment } from '../../environments/environment';

@Component({ selector: 'app-plan-checkout', standalone: true, imports: [CommonModule, TranslateModule],
    template: `<section class="plan-checkout">
      <p *ngIf="config" class="bb-hint" [class.bb-live-payment]="liveMode">{{ (liveMode ? 'planCheckout.live' : 'planCheckout.sandbox') | translate }}</p>
      <p class="bb-hint">{{ 'planCheckout.oneTime' | translate }}</p>
      <div *ngIf="working" class="bb-loading-overlay is-active" aria-live="polite">
        <div class="bb-loading-card" role="status"><div class="bb-spinner" aria-hidden="true"></div>
          <div class="bb-loading-text">{{ 'planCheckout.working' | translate }}</div></div>
      </div>
      <p *ngIf="loading" role="status">{{ 'common.loading' | translate }}</p>
      <p *ngIf="message" role="status">{{ message | translate }}</p>
      <p *ngIf="!auth.getUser()?.isVerified" class="bb-hint">{{ 'referral.verified' | translate }}</p>
      <div #paypalHost [attr.inert]="busy || pending ? '' : null" [hidden]="pending"></div>
      <button *ngIf="!rendered && !loading" class="oauth-btn oauth-btn-primary" type="button"
        [disabled]="!ready || !auth.getUser()?.isVerified || busy" (click)="initialize()">{{ 'planCheckout.pay' | translate }}</button>
    </section>`,
    styles: [`.bb-hint {font-size:12px;color:var(--bb-text-muted);} .bb-live-payment {font-weight:600;color:var(--bb-text);} .bb-loading-card {text-align:center;max-width:360px;}`] })
export class PlanCheckoutComponent implements OnInit, OnDestroy {
    @Input() plan = 'monthly';
    @Output() busyChange = new EventEmitter<boolean>();
    @Output() completed = new EventEmitter<void>();
    @ViewChild('paypalHost', { static: true }) host!: ElementRef<HTMLElement>;
    config: SandboxConfig | null = null;
    loading = true; rendered = false; busy = false; working = false; pending = false; message = '';
    private subscriptions = new Subscription(); private buttons?: PaypalButtons;
    private destroyed = false; private actor?: string; private revision = 0;
    private requestId = ''; private orderId = ''; private lockedPlan = ''; private finished = false;
    private checking = false;
    private pendingTimer?: ReturnType<typeof setTimeout>;
    private pendingChecks = 0;
    private watching = false;
    get liveMode(): boolean { return this.config?.sandbox === false && this.config.fulfillment === 'live-plans'; }
    get ready(): boolean {
        const c = this.config, caps = c?.capabilities;
        const mode = this.liveMode ? c?.protocolVersion === 3 && caps?.livePayments === true && c.webhookConfigured === true && !environment.billingLab
            : !environment.production && c?.sandbox === true && c.protocolVersion === 2 && c.fulfillment === 'sandbox-plans' && caps?.livePayments === false;
        return mode && !!c?.enabled && c.currency === 'EUR' && !!c.clientId && caps?.activatesMembership === true
            && caps.membershipPreview === false && caps.reconcile === true
            && BILLING_PLANS.filter(p => !p.lifetime).every(p => c.plans?.some(q => q.key === p.key
                && q.amount === p.priceEur.toFixed(2) && q.currency === 'EUR' && q.durationDays === p.durationDays));
    }
    constructor(public auth: AuthService, private api: PaypalSandboxService) {}
    ngOnInit(): void {
        this.actor = this.auth.getUser()?._id;
        this.subscriptions.add(this.auth.user$.subscribe(user => {
            if (user?._id === this.actor) return;
            ++this.revision; this.actor = user?._id; this.finished = false; this.requestId = this.orderId = '';
            clearTimeout(this.pendingTimer); this.pendingChecks = 0; this.watching = false; this.checking = false;
            this.pending = this.working = false; this.setBusy(false); this.message = '';
            this.buttons?.close().catch(() => {}); this.buttons = undefined; this.rendered = false;
        }));
        this.subscriptions.add(this.api.config().subscribe({ next: config => {
            this.config = config; this.loading = false;
            if (!this.ready) this.message = 'planCheckout.unavailable';
            else void this.initialize();
        }, error: () => { this.loading = false; this.message = 'planCheckout.unavailable'; } }));
    }
    private valid(actor = this.actor): boolean { return !this.destroyed && !!actor && actor === this.auth.getUser()?._id && !!this.auth.getUser()?.isVerified; }
    private setBusy(value: boolean): void { this.busy = value; this.busyChange.emit(value); }
    async initialize(): Promise<void> {
        if (!this.ready || !this.valid() || this.rendered || this.loading || this.busy) return;
        const actor = this.actor, revision = this.revision;
        this.loading = true;
        try {
            const sdk = await this.api.loadSdk(this.config!);
            if (!this.valid(actor) || revision !== this.revision) return;
            this.buttons = sdk.Buttons({ fundingSource: 'paypal', style: { layout: 'vertical', label: 'pay', tagline: false },
                createOrder: async () => {
                    if (!this.valid(actor) || revision !== this.revision || this.busy || this.pending || !this.ready) throw new Error('CHECKOUT_UNAVAILABLE');
                    this.setBusy(true); this.message = ''; this.finished = false;
                    if (!this.requestId || this.lockedPlan !== this.plan) { this.requestId = crypto.randomUUID(); this.lockedPlan = this.plan; }
                    try {
                        const result = this.liveMode ? await this.api.create(this.lockedPlan, this.requestId, this.config!)
                            : await this.api.create(this.lockedPlan, this.requestId);
                        if (!this.valid(actor) || revision !== this.revision) throw new Error('ACCOUNT_CHANGED');
                        this.orderId = result.orderId; return result.orderId;
                    } catch (error: any) {
                        if (this.valid(actor) && revision === this.revision) {
                            this.setBusy(false);
                            if (error?.error?.code === 'PAYMENT_PENDING') this.markPending();
                            else this.message = 'planCheckout.failed';
                        }
                        throw error;
                    }
                },
                onApprove: async (data: { orderID: string }, actions: { restart(): Promise<unknown> }) => {
                    if (!this.valid(actor) || revision !== this.revision || this.finished || this.working || this.checking || data.orderID !== this.orderId) return;
                    this.working = true; this.setBusy(true); this.watchMembership();
                    let restarted = false;
                    try {
                        const result = this.liveMode ? await this.api.capture(data.orderID, this.config!) : await this.api.capture(data.orderID);
                        if (!this.valid(actor) || revision !== this.revision) return;
                        if (result.sandbox !== !this.liveMode || result.fulfillment !== this.config?.fulfillment) throw new Error('UNEXPECTED_CAPTURE');
                        if (result.completed === true) this.confirm();
                        else this.markPending();
                    } catch (error: any) {
                        if (!this.valid(actor) || revision !== this.revision) return;
                        if (error?.error?.code === 'INSTRUMENT_DECLINED') {
                            this.working = false; this.setBusy(false); restarted = true;
                            try { await actions.restart(); } catch { await this.checkOutcome(actor, false); }
                            return;
                        }
                        await this.checkOutcome(actor, false);
                    } finally { if (!restarted && revision === this.revision && this.valid(actor) && !this.finished) { this.working = false; this.setBusy(false); } }
                },
                onCancel: (data?: { orderID?: string }) => revision === this.revision ? this.closed(actor, data?.orderID, true) : undefined,
                onError: () => revision === this.revision ? this.closed(actor, undefined, false) : undefined,
            });
            await this.buttons.render(this.host.nativeElement);
            if (this.valid(actor) && revision === this.revision) this.rendered = true;
        } catch { if (this.valid(actor) && revision === this.revision) this.message = 'planCheckout.failed'; }
        finally { if (revision === this.revision) this.loading = false; }
    }
    private async closed(actor: string | undefined, orderId: string | undefined, cancelled: boolean): Promise<void> {
        if (!this.valid(actor) || this.working || this.checking || this.finished || (orderId && orderId !== this.orderId)) return;
        this.setBusy(false);
        if (this.orderId) await this.checkOutcome(actor, cancelled);
        else if (!cancelled && !this.pending) this.message = 'planCheckout.failed';
    }
    private async checkOutcome(actor: string | undefined, cancelled: boolean): Promise<void> {
        if (!this.valid(actor) || this.checking || !this.orderId) return;
        const orderId = this.orderId, revision = this.revision;
        this.checking = true; this.pending = true;
        try {
            const result = await this.api.check(orderId);
            if (!this.valid(actor) || revision !== this.revision || this.orderId !== orderId) return;
            if (result.sandbox !== !this.liveMode || result.fulfillment !== this.config?.fulfillment || result.capabilities?.livePayments !== this.liveMode) throw new Error('UNEXPECTED_CHECK');
            const payment = result.payments.find(p => p.orderId === orderId);
            if (!payment) throw new Error('MISSING_PAYMENT');
            if (payment.status === 'completed') this.confirm();
            else if (!payment.capturePending && ['created', 'approved', 'cancelled', 'failed', 'refunded', 'reversed'].includes(payment.status)) {
                clearTimeout(this.pendingTimer); this.pendingChecks = 0;
                this.pending = false; this.requestId = this.orderId = '';
                this.message = cancelled ? '' : 'planCheckout.failed';
            } else this.markPending();
        } catch { if (this.valid(actor) && revision === this.revision) this.markPending(); }
        finally { if (revision === this.revision) this.checking = false; }
    }
    private watchMembership(): void {
        if (!this.watching) { this.watching = true; this.auth.watchPaymentOutcome(); }
    }
    private markPending(): void {
        this.pending = true; this.message = 'planCheckout.pending'; this.watchMembership();
        clearTimeout(this.pendingTimer);
        if (!this.orderId || this.pendingChecks >= 60) return;
        const actor = this.actor, revision = this.revision;
        this.pendingTimer = setTimeout(() => {
            if (!this.valid(actor) || revision !== this.revision || this.finished) return;
            ++this.pendingChecks; void this.checkOutcome(actor, false);
        }, 10000);
    }
    private confirm(): void {
        if (this.finished || !this.valid()) return;
        clearTimeout(this.pendingTimer);
        this.finished = true; this.working = this.pending = false; this.setBusy(false);
        this.auth.refreshMembership(true); this.completed.emit();
    }
    ngOnDestroy(): void {
        this.destroyed = true; ++this.revision; clearTimeout(this.pendingTimer); this.subscriptions.unsubscribe(); this.buttons?.close().catch(() => {});
    }
}
