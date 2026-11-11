import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BillingCapabilities, BillingStatus } from './billing-payments.service';

export interface SandboxConfig { enabled: boolean; sandbox: true; clientId: string | null; currency: string; amount: string | null;
    fulfillment?: 'preview-only' | 'isolated-lab' | 'sandbox-plans'; durationSeconds?: number | null; webhookConfigured?: boolean;
    plans?: { key: string; amount: string; currency: string; durationDays: number }[];
    protocolVersion?: number; capabilities?: BillingCapabilities; }
export interface PaypalButtons { render(element: HTMLElement): Promise<void>; close(): Promise<void>; }
export interface PaypalSdk { Buttons(options: Record<string, unknown>): PaypalButtons; }
export const PAYPAL_REQUEST_TIMEOUT_MS = 120_000;

@Injectable({ providedIn: 'root' })
export class PaypalSandboxService {
    private sdk?: Promise<PaypalSdk>;
    constructor(private http: HttpClient) {}
    config() { return this.http.get<SandboxConfig>(`${environment.apiUrl}/billing/config`).pipe(timeout({ first: 15_000 })); }
    create(plan: string, requestId: string) {
        return firstValueFrom(this.http.post<{ orderId: string }>(`${environment.apiUrl}/billing/orders`, { plan, requestId })
            .pipe(timeout({ first: PAYPAL_REQUEST_TIMEOUT_MS })));
    }
    capture(orderId: string) {
        // A client timeout leaves the server outcome unknown. Never auto-retry a POST.
        return firstValueFrom(this.http.post<{ completed: boolean; sandbox: boolean; membershipActivated: boolean; fulfillment?: string }>(
            `${environment.apiUrl}/billing/orders/${encodeURIComponent(orderId)}/capture`, {})
            .pipe(timeout({ first: PAYPAL_REQUEST_TIMEOUT_MS })));
    }
    check(orderId: string) {
        // Reconciliation reads provider evidence only; it never captures an order.
        return firstValueFrom(this.http.post<BillingStatus>(
            `${environment.apiUrl}/billing/orders/${encodeURIComponent(orderId)}/reconcile`, {})
            .pipe(timeout({ first: PAYPAL_REQUEST_TIMEOUT_MS })));
    }
    loadSdk(config: SandboxConfig): Promise<PaypalSdk> {
        if (!config.enabled || !config.sandbox || !config.clientId) return Promise.reject(new Error('PAYPAL_NOT_CONFIGURED'));
        if (this.sdk) return this.sdk;
        this.sdk = new Promise<PaypalSdk>((resolve, reject) => {
            const script = document.createElement('script');
            const params = new URLSearchParams({ 'client-id': config.clientId!, currency: 'EUR', components: 'buttons', intent: 'capture' });
            script.src = 'https://www.paypal.com/sdk/js?' + params.toString();
            script.dataset['namespace'] = 'bonzoPayPal';
            const timeout = setTimeout(() => { script.remove(); this.sdk = undefined; reject(new Error('PAYPAL_SDK_TIMEOUT')); }, 20_000);
            script.onload = () => {
                clearTimeout(timeout);
                const sdk = (window as unknown as { bonzoPayPal?: PaypalSdk }).bonzoPayPal;
                if (sdk) resolve(sdk);
                else { script.remove(); this.sdk = undefined; reject(new Error('PAYPAL_SDK_UNAVAILABLE')); }
            };
            script.onerror = () => { clearTimeout(timeout); script.remove(); this.sdk = undefined; reject(new Error('PAYPAL_SDK_UNAVAILABLE')); };
            document.head.append(script);
        });
        return this.sdk;
    }
}
