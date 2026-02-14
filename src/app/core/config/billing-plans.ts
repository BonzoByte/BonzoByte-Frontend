export type BillingPlanKey = 'daily' | 'monthly' | 'semiannual' | 'annual' | 'founders';

export interface BillingPlan {
    key: BillingPlanKey;
    title: string;
    priceEur: number;
    durationDays: number | null;
    lifetime?: boolean;
    limit?: number;
    badge?: string;
}

export const BILLING_PLANS: BillingPlan[] = [
    { key: 'daily', title: 'Daily Pass', priceEur: 0.2, durationDays: 1, badge: 'Try it' },
    { key: 'monthly', title: 'Monthly', priceEur: 4, durationDays: 30, badge: 'Best for starters' },
    { key: 'semiannual', title: '6 months', priceEur: 18, durationDays: 182, badge: 'Save ~25%' },
    { key: 'annual', title: 'Annual', priceEur: 24, durationDays: 365, badge: 'Best value' },
    { key: 'founders', title: 'Founders Pass', priceEur: 100, durationDays: null, lifetime: true, limit: 100, badge: 'Lifetime' },
];