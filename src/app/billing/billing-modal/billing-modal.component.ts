import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, ViewEncapsulation } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { RegionalSettingsService } from '../../core/services/regional-settings.service';
import { BILLING_PLANS, BillingPlan } from '../../core/config/billing-plans';
import { BbModalShellComponent } from "@app/shared/ui/bb-modal-shell.component/bb-modal-shell.component";
import { ReferralCardComponent } from '../referral-card.component';
import { PaypalSandboxComponent } from '../paypal-sandbox.component';
import { PlanCheckoutComponent } from '../plan-checkout.component';
import { LocalizedSnackbarService } from '../../core/i18n/localized-snackbar.service';
import { environment } from '../../../environments/environment';
import { BillingRefundConfirmation } from '../../core/services/billing-payments.service';

@Component({
    selector: 'app-billing-modal',
    standalone: true,
    imports: [CommonModule, BbModalShellComponent, TranslateModule, ReferralCardComponent, PaypalSandboxComponent, PlanCheckoutComponent],
    templateUrl: './billing-modal.component.html',
    styleUrls: ['./billing-modal.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class BillingModalComponent {
    @Output() closed = new EventEmitter<void>();

    readonly labMode = environment.billingLab;
    plans: BillingPlan[] = BILLING_PLANS.filter(p => p.key !== 'founders');
    selectedKey: BillingPlan['key'] = 'monthly';
    paying = false;
    refundResult: BillingRefundConfirmation | null = null;
    get refundTierKey(): string | null {
        const tier = this.refundResult?.entitlements?.tier;
        return tier && ['standard', 'trial', 'premium', 'vip', 'admin'].includes(tier) ? 'membership.' + tier : null;
    }

    constructor(public regional: RegionalSettingsService, private notices: LocalizedSnackbarService) {}

    signIn(): void { this.closed.emit(); window.dispatchEvent(new CustomEvent('openLogin')); }
    invitationCompleted(email: string): void {
        this.notices.open('referral.sentTo', 'auth.ok', { duration: 8000,
            horizontalPosition: 'right', verticalPosition: 'bottom', panelClass: 'success-snackbar' }, { email });
        this.closed.emit();
    }
    paymentCompleted(): void {
        this.paying = false;
        this.notices.open(this.labMode ? 'billingLab.completed' : 'planCheckout.completed', 'auth.ok', { duration: 8000 });
        this.closed.emit();
    }
    refundCompleted(result: BillingRefundConfirmation): void {
        if (!this.labMode) return;
        this.paying = false;
        this.refundResult = result;
        // Destroy the payment dialog and its checkout controls; show a separate,
        // compact receipt until acknowledged. Never initiate another payment here.
    }

    private openedAt = Date.now();

    close(): void {
    // Ignore the opening click for 150 ms so it cannot immediately close the modal.
        if (this.paying || Date.now() - this.openedAt < 150) return;
        this.closed.emit();
    }

    pick(key: BillingPlan['key']): void {
        if (!this.paying) this.selectedKey = key;
    }

    perDay(plan: BillingPlan): number | null {
        if (plan.lifetime || !plan.durationDays) return null;
        return plan.priceEur / plan.durationDays;
    }

    formatDuration(plan: BillingPlan): string {
        if (plan.lifetime) return this.regional.text('billing.lifetime');
        if (!plan.durationDays) return '—';
        if (plan.durationDays >= 360) return this.regional.text('billing.year');
        return this.regional.plural('billing.days', plan.durationDays);
    }
}
