import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, timeout } from 'rxjs';
import { BillingPaymentsService, BillingPayment, BillingRefundConfirmation, BillingStatus } from '../core/services/billing-payments.service';
import { AuthService } from '../core/services/auth.service';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import { environment } from '../../environments/environment';

@Component({ selector: 'app-billing-payments', standalone: true, imports: [CommonModule, TranslateModule],
    template: `<div *ngIf="busy" class="bb-loading-overlay is-active" aria-live="polite" aria-atomic="true">
      <div class="bb-loading-card" role="status" [attr.aria-label]="'billingLab.working.' + busyAction | translate">
        <div class="bb-spinner" aria-hidden="true"></div>
        <div class="bb-loading-text">{{ 'billingLab.working.' + busyAction | translate }}</div>
        <small *ngIf="busyAction === 'refund'">{{ 'billingLab.refundWait' | translate }}</small>
      </div>
    </div>
    <section class="lab-payments">
      <h4>{{ 'billingLab.history' | translate }}</h4>
      <p *ngIf="!labMode">{{ 'billingShared.previewNotice' | translate }}</p>
      <p *ngIf="!payments.length && !busy">{{ 'billingLab.empty' | translate }}</p>
      <div *ngIf="selectedPayment as payment" class="lab-payment">
        <strong>{{ (payment.orderId === payments[0].orderId ? 'billingLab.latestPayment' : 'billingLab.selectedPayment') | translate }}</strong>
        <span>{{ 'billing.plans.' + payment.plan + '.title' | translate }} · {{ payment.amount | currency:payment.currency:'symbol':'1.2-2':regional.locale() }}</span>
        <span class="lab-payment-status">{{ 'billingLab.status.' + payment.status | translate }}</span>
        <small>{{ 'billingLab.paymentReference' | translate:{id: payment.orderId} }}</small>
        <small *ngIf="payment.grantEndsAt && !payment.revokedAt">{{ 'membership.until' | translate:{date: regional.dateTime(payment.grantEndsAt, 'utc')} }}</small>
        <div class="lab-payment-actions" [attr.aria-busy]="busy">
        <button type="button" class="oauth-btn" [disabled]="busy || checkoutBusy || !canReconcile" (click)="reconcile(payment)">{{ 'billingLab.check' | translate }}</button>
        <button *ngIf="payment.status === 'approved' && canReconcile" type="button" class="oauth-btn oauth-btn-primary"
          [disabled]="busy || checkoutBusy" (click)="completePayment(payment)">{{ 'checkoutRecovery.finish' | translate }}</button>
        <button *ngIf="canRefund && payment.status === 'completed' && !payment.revokedAt" type="button" class="oauth-btn"
          [disabled]="busy || checkoutBusy || payment.refundStatus === 'PENDING'" (click)="refund(payment)">{{ (busyAction === 'refund' ? 'billingLab.working.refund' : 'billingLab.refund') | translate }}</button>
        </div>
        <small *ngIf="payment.refundStatus === 'PENDING'">{{ 'billingLab.refundPending' | translate }}</small>
        <button *ngIf="payment.orderId !== payments[0].orderId" type="button" class="oauth-btn" [disabled]="busy || checkoutBusy"
          (click)="selectPayment(payments[0])">{{ 'billingLab.backToLatest' | translate }}</button>
      </div>
      <details *ngIf="payments.length > 1" class="lab-payment-history" [open]="historyOpen" (toggle)="historyOpen = historyDetails.open" #historyDetails>
        <summary>{{ 'billingLab.previousPayments' | translate:{count: payments.length - 1} }}</summary>
        <div *ngFor="let payment of payments.slice(1)" class="lab-history-row">
          <span>{{ 'billingLab.paymentReference' | translate:{id: payment.orderId} }} · {{ 'billingLab.status.' + payment.status | translate }}</span>
          <button type="button" class="oauth-btn" [disabled]="busy || checkoutBusy" (click)="selectPayment(payment)">{{ 'billingLab.viewPayment' | translate }}</button>
        </div>
      </details>
      <p *ngIf="failed" role="status">{{ 'billingLab.failed' | translate }}</p>
      <button type="button" class="oauth-btn" [disabled]="busy || checkoutBusy" (click)="refresh()">{{ 'billingLab.refresh' | translate }}</button>
      <details *ngIf="labMode && !webhookConfigured" class="lab-technical">
        <summary>{{ 'billingLab.technicalDetails' | translate }}</summary>
        <p>{{ 'billingLab.webhookPending' | translate }}</p>
      </details>
    </section>`,
    styles: [`.lab-payments { border-top:1px solid var(--bb-control-border);margin-top:12px;padding-top:8px;font-size:12px; }
      h4 {font-size:13px;} p, small {color:var(--bb-text-muted);} .lab-payment {display:grid;gap:6px;margin:8px 0;padding:10px;border:1px solid var(--bb-control-border);border-radius:10px;}
      .lab-payment-actions {display:flex;flex-wrap:wrap;gap:8px;} .lab-history-row {display:flex;align-items:center;gap:8px;padding:8px 0;}
      .lab-history-row span {flex:1;min-width:0;} .lab-payment-status {font-weight:600;}
      .bb-loading-card {max-width:min(360px, calc(100vw - 32px));text-align:center;}
      details {margin:10px 0;} summary {cursor:pointer;} summary:focus-visible {outline:2px solid var(--bb-theme-accent);outline-offset:2px;}
      span, small {overflow-wrap:anywhere;} button {font-size:12px;max-width:100%;white-space:normal;}`],
})
export class BillingPaymentsComponent implements OnInit, OnDestroy {
    @Input() webhookConfigured = false;
    @Input() checkoutBusy = false;
    @Output() refundCompleted = new EventEmitter<BillingRefundConfirmation>();
    @Output() busyChange = new EventEmitter<boolean>();
    @Output() completeRequested = new EventEmitter<BillingPayment>();
    readonly labMode = environment.billingLab;
    canRefund = false; canReconcile = false;
    payments: BillingPayment[] = []; busy = false; failed = false;
    busyAction: 'refresh' | 'check' | 'refund' | null = null;
    historyOpen = false;
    private selectedOrderId: string | null = null;
    private refundOrderId: string | null = null;
    get selectedPayment(): BillingPayment | undefined {
        return this.payments.find(p => p.orderId === this.selectedOrderId) ?? this.payments[0];
    }
    selectPayment(payment: BillingPayment): void {
        if (this.busy || this.checkoutBusy) return;
        this.selectedOrderId = payment.orderId; this.historyOpen = false;
    }
    private request?: Subscription; private userSub?: Subscription; private revision = 0; private account?: string;
    private initializing = true;
    constructor(private api: BillingPaymentsService, private auth: AuthService, public regional: RegionalSettingsService) {}
    ngOnInit(): void {
        this.userSub = this.auth.user$.subscribe(user => {
            if (this.account === user?._id) return;
            this.account = user?._id; ++this.revision; this.request?.unsubscribe();
            this.payments = []; this.setBusy(false); this.busyAction = null; this.failed = false;
            this.canRefund = this.canReconcile = false;
            this.selectedOrderId = this.refundOrderId = null; this.historyOpen = false;
            if (user?.isVerified) this.refresh();
        });
        this.initializing = false;
    }
    refresh(): void { this.run(() => this.api.status(), 'refresh'); }
    reconcile(payment: BillingPayment): void {
        if (this.canReconcile) this.run(() => this.api.reconcile(payment.orderId), 'check');
    }
    refund(payment: BillingPayment): void {
        if (this.labMode && this.canRefund && payment.status === 'completed' && !payment.revokedAt && payment.refundStatus !== 'PENDING')
            this.run(() => this.api.refund(payment.orderId), 'refund', payment.orderId);
    }
    completePayment(payment: BillingPayment): void {
        if (!this.busy && !this.checkoutBusy && this.canReconcile && this.auth.getUser()?.isVerified
            && payment.status === 'approved' && this.payments.includes(payment)) this.completeRequested.emit(payment);
    }
    private setBusy(value: boolean): void { this.busy = value; if (!this.initializing) this.busyChange.emit(value); }
    private run(action: () => ReturnType<BillingPaymentsService['status']>, kind: 'refresh' | 'check' | 'refund', refundOrderId?: string): void {
        const account = this.auth.getUser()?._id;
        if (!account || !this.auth.getUser()?.isVerified || this.busy || this.checkoutBusy) return;
        if (refundOrderId) this.refundOrderId = refundOrderId;
        this.request?.unsubscribe(); const revision = ++this.revision; this.setBusy(true); this.failed = false;
        this.busyAction = kind;
        // An interrupted response is uncertain, not a failed payment. Release the UI
        // so the user can check status; never retry a refund automatically.
        this.request = action().pipe(timeout({ first: 60_000 })).subscribe({ next: (result: BillingStatus) => {
            if (revision !== this.revision || account !== this.auth.getUser()?._id) return;
            const caps = result.capabilities;
            if (result.sandbox !== true || result.fulfillment !== (this.labMode ? 'isolated-lab' : 'preview-only')
                || !Array.isArray(result.payments) || !caps || caps.livePayments !== false
                || caps.activatesMembership !== this.labMode || caps.refund !== this.labMode) {
                this.failed = true; this.payments = []; this.canRefund = this.canReconcile = false; return;
            }
            this.canRefund = this.labMode && caps.refund;
            this.canReconcile = caps.reconcile;
            this.payments = result.payments;
            if (this.labMode) this.auth.refreshMembership(true);
            // A request/timeout/pending refund is not confirmation. Only announce the
            // exact requested order, including recovery through an explicit status check.
            const refunded = this.payments.find(p => p.orderId === this.refundOrderId);
            if (this.labMode && refunded?.status === 'refunded' && refunded.refundStatus !== 'PENDING'
                && Number.isFinite(Date.parse(refunded.revokedAt ?? ''))) {
                this.refundOrderId = null;
                this.refundCompleted.emit({ payment: refunded, entitlements: result.entitlements });
            }
        }, error: () => { if (revision === this.revision) { this.failed = true; this.setBusy(false); this.busyAction = null; } },
        complete: () => { if (revision === this.revision) { this.setBusy(false); this.busyAction = null; } } });
    }
    ngOnDestroy(): void { ++this.revision; this.request?.unsubscribe(); this.userSub?.unsubscribe(); }
}
