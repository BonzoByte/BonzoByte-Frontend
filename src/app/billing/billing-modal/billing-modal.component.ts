import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, ViewEncapsulation } from '@angular/core';
import { BILLING_PLANS, BillingPlan } from '../../core/config/billing-plans';

@Component({
    selector: 'app-billing-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './billing-modal.component.html',
    encapsulation: ViewEncapsulation.None,
})
export class BillingModalComponent {
    @Output() closed = new EventEmitter<void>();

    plans: BillingPlan[] = BILLING_PLANS;
    selectedKey: BillingPlan['key'] = 'monthly';

    private openedAt = Date.now();

    close(): void {
        // ignoriraj klik unutar prvih 150ms (isti click koji je otvorio modal)
        if (Date.now() - this.openedAt < 150) return;
        this.closed.emit();
    }

    pick(key: BillingPlan['key']): void {
        this.selectedKey = key;
    }

    continue(): void {
        const chosen = this.plans.find(p => p.key === this.selectedKey);
        console.log('[BILLING] continue (placeholder), selected=', chosen);

        // kasnije: redirect na checkout
        // npr: window.location.href = `${environment.apiUrl}/billing/checkout?plan=${chosen?.key}`;

        this.close();
    }

    perDay(plan: BillingPlan): number | null {
        if (plan.lifetime || !plan.durationDays) return null;
        return plan.priceEur / plan.durationDays;
    }

    formatDuration(plan: BillingPlan): string {
        if (plan.lifetime) return 'Lifetime';
        if (!plan.durationDays) return '—';
        if (plan.durationDays === 1) return '1 day';
        if (plan.durationDays <= 31) return `${plan.durationDays} days`;
        if (plan.durationDays >= 360) return '1 year';
        return `${plan.durationDays} days`;
    }
}