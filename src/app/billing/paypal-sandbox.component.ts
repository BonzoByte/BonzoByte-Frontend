import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { PaypalButtons, PaypalSandboxService, SandboxConfig } from '../core/services/paypal-sandbox.service';
import { SandboxMembershipPreviewComponent } from './sandbox-membership-preview.component';
import { BillingPaymentsComponent } from './billing-payments.component';
import { BillingPayment, BillingRefundConfirmation } from '../core/services/billing-payments.service';
import { environment } from '../../environments/environment';

@Component({ selector: 'app-paypal-sandbox', standalone: true, imports: [CommonModule, TranslateModule, SandboxMembershipPreviewComponent, BillingPaymentsComponent],
    template: `<section class="bb-paypal-sandbox">
      <div *ngIf="checking || capturing" class="bb-loading-overlay is-active" aria-live="polite">
        <div class="bb-loading-card" role="status">
          <div class="bb-spinner" aria-hidden="true"></div>
          <div class="bb-loading-text">{{ (checking ? 'checkoutRecovery.checking' : 'checkoutRecovery.completing') | translate }}</div>
        </div>
      </div>
      <p class="bb-hint">{{ (labMode ? 'billingLab.checkout' : 'checkout.sandbox') | translate }}</p>
      <p *ngIf="environmentMismatch" role="alert">{{ 'billingLab.mismatch' | translate }}</p>
      <p *ngIf="config?.enabled && !sharedModuleReady && !environmentMismatch" role="status">{{ 'billingShared.restartRequired' | translate }}</p>
      <p *ngIf="!config?.enabled" class="bb-hint">{{ 'checkout.unavailable' | translate }}</p>
      <button *ngIf="!rendered && !recoveryOrderId" class="oauth-btn oauth-btn-primary" type="button" (click)="start()"
        [disabled]="!config?.enabled || !auth.getUser()?.isVerified || loading || historyBusy || environmentMismatch || !sharedModuleReady">{{ 'checkout.start' | translate }}</button>
      <p *ngIf="!auth.getUser()?.isVerified" class="bb-hint">{{ 'referral.verified' | translate }}</p>
      <div #paypalHost [hidden]="!!recoveryOrderId" [attr.inert]="historyBusy || checkoutBusy ? '' : null"></div>
      <p *ngIf="message" role="status">{{ message | translate }}</p>
      <div *ngIf="recoveryOrderId" class="bb-checkout-recovery">
        <small>{{ 'billingLab.paymentReference' | translate:{id: recoveryOrderId} }}</small>
        <small *ngIf="recoveryPayment as payment">{{ 'billing.plans.' + payment.plan + '.title' | translate }} · {{payment.amount}} {{payment.currency}} (Sandbox)</small>
        <div class="bb-checkout-recovery-actions">
          <button *ngIf="recoveryPayment?.status === 'approved'" class="oauth-btn oauth-btn-primary" type="button"
            [disabled]="checkoutBusy || historyBusy" (click)="completeApprovedPayment(recoveryPayment!)">{{ 'checkoutRecovery.finish' | translate }}</button>
          <button class="oauth-btn" type="button" [disabled]="checkoutBusy || historyBusy" (click)="checkPayment()">{{ 'billingLab.check' | translate }}</button>
          <button *ngIf="recoveryPayment?.status === 'created' && rendered" class="oauth-btn" type="button"
            [disabled]="checkoutBusy || historyBusy" (click)="resumePayPal()">{{ 'checkoutRecovery.reopen' | translate }}</button>
        </div>
      </div>
      <app-sandbox-membership-preview *ngIf="config?.enabled && sharedModuleReady && auth.getUser()?.isVerified && !labMode && !environmentMismatch"
        [checkoutBusy]="checkoutBusy"></app-sandbox-membership-preview>
      <app-billing-payments *ngIf="labMode && config?.enabled && sharedModuleReady && !environmentMismatch && auth.getUser()?.isVerified"
        [checkoutBusy]="checkoutBusy || !!recoveryOrderId" [webhookConfigured]="!!config?.webhookConfigured"
        (busyChange)="historyBusyChanged($event)" (completeRequested)="completeApprovedPayment($event)"
        (refundCompleted)="refundCompleted.emit($event)"></app-billing-payments>
      <details *ngIf="!labMode && config?.enabled && sharedModuleReady && !environmentMismatch && auth.getUser()?.isVerified"
        class="bb-payment-tools" (toggle)="toggleHistory(historyDetails)" #historyDetails>
        <summary>{{ 'billingLab.history' | translate }}</summary>
        <app-billing-payments *ngIf="historyOpen" [checkoutBusy]="checkoutBusy || !!recoveryOrderId"
          (busyChange)="historyBusyChanged($event)" (completeRequested)="completeApprovedPayment($event)"></app-billing-payments>
      </details>
    </section>`, styles: [`.bb-payment-tools {margin-top:12px;font-size:12px;} summary {cursor:pointer;}
      summary:focus-visible {outline:2px solid var(--bb-theme-accent);outline-offset:2px;}
      .bb-checkout-recovery {display:grid;gap:8px;font-size:12px;overflow-wrap:anywhere;}
      .bb-checkout-recovery-actions {display:flex;flex-wrap:wrap;gap:8px;}
      .bb-loading-card {max-width:min(360px, calc(100vw - 32px));text-align:center;}`] })
export class PaypalSandboxComponent implements OnInit, OnDestroy {
    @Input() plan = 'monthly';
    @Output() busyChange = new EventEmitter<boolean>();
    @Output() completed = new EventEmitter<void>();
    @Output() refundCompleted = new EventEmitter<BillingRefundConfirmation>();
    @ViewChild('paypalHost', { static: true }) host!: ElementRef<HTMLElement>;
    config: SandboxConfig | null = null;
    loading = false; rendered = false; message = '';
    checkoutBusy = false;
    historyBusy = false; historyOpen = false;
    checking = false; capturing = false;
    recoveryOrderId: string | null = null;
    recoveryPayment: BillingPayment | null = null;
    readonly labMode = environment.billingLab;
    get environmentMismatch(): boolean { return !!this.config?.enabled && (this.config.sandbox !== true
        || this.config.fulfillment !== (this.labMode ? 'isolated-lab' : 'preview-only')); }
    get sharedModuleReady(): boolean {
        const c = this.config?.capabilities;
        return this.config?.protocolVersion === 1 && !!c && c.history === true && c.reconcile === true && c.livePayments === false
            && c.activatesMembership === this.labMode && c.refund === this.labMode && c.membershipPreview === !this.labMode;
    }
    private request?: Subscription;
    private buttons?: PaypalButtons;
    private destroyed = false;
    private accountId?: string;
    private userSub?: Subscription;
    private revision = 0;
    private currentOrderId: string | null = null;
    private confirmedOrderId: string | null = null;
    private requestId = ''; private lockedPlan = '';
    constructor(public auth: AuthService, private paypal: PaypalSandboxService) {}
    ngOnInit(): void {
        this.request = this.paypal.config().subscribe({ next: config => this.config = config, error: () => {} });
        let actor = this.auth.getUser()?._id;
        this.userSub = this.auth.user$.subscribe(user => {
            if (actor === user?._id) return;
            actor = user?._id; ++this.revision;
            this.accountId = undefined; this.currentOrderId = this.confirmedOrderId = this.recoveryOrderId = null;
            this.recoveryPayment = null; this.requestId = ''; this.message = '';
            this.checking = this.capturing = this.loading = false; this.setBusy(false);
            this.buttons?.close().catch(() => {}); this.buttons = undefined; this.rendered = false;
        });
    }
    async start(): Promise<void> {
        if (!this.config?.enabled || !this.sharedModuleReady || this.environmentMismatch || !this.auth.getUser()?.isVerified || this.loading || this.historyBusy || this.checkoutBusy || this.recoveryOrderId || this.rendered) return;
        this.loading = true; this.message = '';
        const startRevision = this.revision;
        const actor = this.auth.getUser()?._id;
        this.accountId = actor;
        const sameAccount = () => {
            if (!this.sameAccount(actor)) throw new Error('ACCOUNT_CHANGED');
        };
        try {
            const sdk = await this.paypal.loadSdk(this.config);
            if (!this.sameAccount(actor)) return;
            this.buttons = sdk.Buttons({
                style: { layout: 'vertical', label: 'paypal' },
                createOrder: async () => {
                    if (this.historyBusy || this.checkoutBusy || this.recoveryOrderId) throw new Error('BILLING_BUSY');
                    sameAccount(); this.setBusy(true); this.message = '';
                    const creationRevision = this.revision;
                    this.confirmedOrderId = null; this.currentOrderId = null;
                    if (!this.requestId || this.lockedPlan !== this.plan) { this.requestId = crypto.randomUUID(); this.lockedPlan = this.plan; }
                    try {
                        const result = await this.paypal.create(this.lockedPlan, this.requestId);
                        sameAccount();
                        this.currentOrderId = result.orderId;
                        return result.orderId;
                    } catch (error) {
                        if (creationRevision === this.revision) {
                            if (this.sameAccount(actor)) this.message = this.labMode ? 'billingLab.failed' : 'checkout.failed';
                            this.setBusy(false);
                        }
                        throw error; // Let the SDK show the error; retain the idempotency key.
                    }
                },
                onApprove: async (data: { orderID: string }, actions: { restart(): Promise<unknown> }) => {
                    // After a closure/error, recovery requires a deliberate click, even if a late approval arrives.
                    if (!this.sameAccount(actor) || this.recoveryOrderId || data.orderID !== this.currentOrderId) return;
                    await this.captureOrder(data.orderID, actor!, actions);
                },
                onCancel: (data?: { orderID?: string }) => this.closedPopup(actor, data?.orderID, true),
                onError: () => this.closedPopup(actor, undefined, false),
            });
            await this.buttons.render(this.host.nativeElement);
            if (startRevision === this.revision && this.sameAccount(actor)) this.rendered = true;
        } catch { if (startRevision === this.revision && this.sameAccount(actor)) this.message = 'checkout.failed'; }
        finally { if (startRevision === this.revision) this.loading = false; }
    }
    private sameAccount(actor: string | undefined): boolean {
        return !!actor && !this.destroyed && actor === this.auth.getUser()?._id && !!this.auth.getUser()?.isVerified;
    }
    private async closedPopup(actor: string | undefined, id: string | undefined, cancelled: boolean): Promise<void> {
        if (!this.sameAccount(actor) || this.capturing || this.checking || this.confirmedOrderId
            || (id && this.currentOrderId && id !== this.currentOrderId)) return;
        const orderId = this.currentOrderId; // Only an order created by this checkout, never an arbitrary SDK ID.
        if (!orderId) { this.message = cancelled ? 'checkout.cancelled' : 'checkout.failed'; this.setBusy(false); return; }
        await this.inspectOrder(orderId, actor!);
    }
    async checkPayment(): Promise<void> {
        if (!this.recoveryOrderId || !this.sameAccount(this.accountId) || this.checking || this.capturing || this.historyBusy) return;
        await this.inspectOrder(this.recoveryOrderId, this.accountId!);
    }
    private async inspectOrder(orderId: string, actor: string): Promise<void> {
        const revision = ++this.revision;
        this.checking = true; this.recoveryOrderId = orderId; this.recoveryPayment = null;
        this.setBusy(true); this.message = 'checkoutRecovery.checking';
        try {
            const result = await this.paypal.check(orderId);
            if (revision !== this.revision || !this.sameAccount(actor)) return;
            const caps = result.capabilities;
            if (result.sandbox !== true || result.fulfillment !== (this.labMode ? 'isolated-lab' : 'preview-only')
                || !caps || caps.livePayments !== false || caps.activatesMembership !== this.labMode
                || caps.refund !== this.labMode || !Array.isArray(result.payments)) throw new Error('UNEXPECTED_STATUS');
            const payment = result.payments.find(p => p.orderId === orderId);
            if (!payment || payment.currency !== 'EUR' || payment.amount !== '0.01') throw new Error('UNEXPECTED_PAYMENT');
            this.recoveryPayment = payment;
            if (payment.status === 'completed') {
                this.confirmedOrderId = orderId;
                if (this.labMode) this.auth.refreshMembership(true);
                this.completed.emit();
            } else {
                this.message = payment.status === 'approved' ? 'checkoutRecovery.approved'
                    : payment.status === 'pending' ? 'checkoutRecovery.pending'
                    : ['refunded', 'partially_refunded', 'reversed'].includes(payment.status) ? 'checkoutRecovery.refunded'
                    : 'checkoutRecovery.incomplete';
            }
        } catch {
            if (revision === this.revision && this.sameAccount(actor)) this.message = 'checkoutRecovery.uncertain';
        } finally {
            if (revision === this.revision) { this.checking = false; this.setBusy(false); }
        }
    }
    async completeApprovedPayment(payment: BillingPayment): Promise<void> {
        const actor = this.auth.getUser()?._id;
        if (!this.sameAccount(actor) || !this.config?.enabled || !this.sharedModuleReady || this.environmentMismatch
            || this.checkoutBusy || this.historyBusy || payment.status !== 'approved'
            || payment.currency !== 'EUR' || payment.amount !== '0.01'
            || (this.recoveryOrderId && this.recoveryPayment !== payment)) return;
        this.accountId = actor; this.currentOrderId = payment.orderId;
        this.recoveryPayment = payment;
        await this.captureOrder(payment.orderId, actor!);
    }
    private async captureOrder(orderId: string, actor: string, actions?: { restart(): Promise<unknown> }): Promise<void> {
        if (this.capturing || this.confirmedOrderId === orderId || !this.sameAccount(actor)) return;
        const revision = ++this.revision;
        this.checking = false; this.capturing = true; this.recoveryOrderId = orderId;
        this.setBusy(true); this.message = 'checkoutRecovery.completing';
        try {
            const result = await this.paypal.capture(orderId);
            if (revision !== this.revision || !this.sameAccount(actor)) return;
            if (result.completed !== true || result.sandbox !== true || (!this.labMode && result.membershipActivated !== false)
                || (this.labMode && result.fulfillment !== 'isolated-lab')) throw new Error('UNEXPECTED_CAPTURE');
            this.confirmedOrderId = orderId;
            if (this.labMode) this.auth.refreshMembership(true);
            this.completed.emit();
        } catch (error: any) {
            if (revision !== this.revision || !this.sameAccount(actor)) return;
            if (error?.error?.code === 'INSTRUMENT_DECLINED' && actions) {
                ++this.revision; // A restarted SDK attempt owns its own busy state.
                this.capturing = false; this.recoveryOrderId = null; this.recoveryPayment = null; this.setBusy(false);
                try { await actions.restart(); }
                catch { await this.closedPopup(actor, orderId, false); }
                return;
            }
            this.recoveryPayment = null; // Uncertain outcome: check before allowing another capture.
            this.message = 'checkoutRecovery.uncertain';
        } finally {
            if (revision === this.revision) { this.capturing = false; this.setBusy(false); }
        }
    }
    resumePayPal(): void {
        if (!this.sameAccount(this.accountId) || this.checkoutBusy || this.historyBusy || this.recoveryPayment?.status !== 'created') return;
        this.recoveryOrderId = null; this.recoveryPayment = null; this.message = '';
        // Keep the same idempotency key: reopening does not create a second order.
    }
    toggleHistory(details: HTMLDetailsElement): void {
        // Keyboard activation can reach a summary even under the loading overlay.
        // Keep the in-flight component alive so its completion releases checkout.
        if (this.historyBusy && !details.open) details.open = true;
        this.historyOpen = details.open;
    }
    historyBusyChanged(busy: boolean): void { this.historyBusy = busy; this.busyChange.emit(this.checkoutBusy || busy); }
    private setBusy(busy: boolean): void { this.checkoutBusy = busy; this.busyChange.emit(busy || this.historyBusy); }
    ngOnDestroy(): void {
        this.destroyed = true; ++this.revision; this.request?.unsubscribe(); this.userSub?.unsubscribe();
        this.buttons?.close().catch(() => {});
    }
}
