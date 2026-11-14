import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BillingCapabilities, BillingStatus } from './billing-payments.service';

export interface SandboxConfig { enabled: boolean; sandbox: boolean; clientId: string | null; currency: string; amount: string | null;
    fulfillment?: 'preview-only' | 'isolated-lab' | 'sandbox-plans' | 'live-plans'; durationSeconds?: number | null; webhookConfigured?: boolean;
    plans?: { key: string; amount: string; currency: string; durationDays: number }[];
    protocolVersion?: number; capabilities?: BillingCapabilities; }
export interface PaypalButtons { render(element: HTMLElement): Promise<void>; close(): Promise<void>; }
export interface PaypalSdk { Buttons(options: Record<string, unknown>): PaypalButtons; }
export const PAYPAL_REQUEST_TIMEOUT_MS = 120_000;

@Injectable({ providedIn: 'root' })
export class PaypalSandboxService {
    private sdk?: Promise<PaypalSdk>;
    private sdkIdentity?: string;
    constructor(private http: HttpClient) {}
    config() { return this.http.get<SandboxConfig>(`${environment.apiUrl}/billing/config`).pipe(timeout({ first: 15_000 })); }
    private context(config?: SandboxConfig): object {
        if (!config || config.sandbox === true) return {};
        if (config.sandbox !== false || config.fulfillment !== 'live-plans' || config.protocolVersion !== 3
            || config.capabilities?.livePayments !== true || !config.webhookConfigured) throw new Error('BILLING_ENVIRONMENT_MISMATCH');
        return { environment: 'live', protocolVersion: 3 };
    }
    create(plan: string, requestId: string, config?: SandboxConfig) {
        return firstValueFrom(this.http.post<{ orderId: string }>(`${environment.apiUrl}/billing/orders`, { plan, requestId, ...this.context(config) })
            .pipe(timeout({ first: PAYPAL_REQUEST_TIMEOUT_MS })));
    }
    capture(orderId: string, config?: SandboxConfig) {
        // A client timeout leaves the server outcome unknown. Never auto-retry a POST.
        return firstValueFrom(this.http.post<{ completed: boolean; sandbox: boolean; membershipActivated: boolean; fulfillment?: string }>(
            `${environment.apiUrl}/billing/orders/${encodeURIComponent(orderId)}/capture`, this.context(config))
            .pipe(timeout({ first: PAYPAL_REQUEST_TIMEOUT_MS })));
    }
    check(orderId: string) {
        // Reconciliation reads provider evidence only; it never captures an order.
        return firstValueFrom(this.http.post<BillingStatus>(
            `${environment.apiUrl}/billing/orders/${encodeURIComponent(orderId)}/reconcile`, {})
            .pipe(timeout({ first: PAYPAL_REQUEST_TIMEOUT_MS })));
    }
    loadSdk(config: SandboxConfig): Promise<PaypalSdk> {
        if (!config.enabled || !config.clientId || (config.sandbox !== true && config.sandbox !== false)) return Promise.reject(new Error('PAYPAL_NOT_CONFIGURED'));
        try { this.context(config); } catch (error) { return Promise.reject(error); }
        const identity = `${config.sandbox}:${config.clientId}`;
        if (this.sdk && identity !== this.sdkIdentity) return Promise.reject(new Error('PAYPAL_SDK_ENVIRONMENT_CHANGED'));
        if (this.sdk) return this.sdk;
        this.sdkIdentity = identity;
        this.sdk = new Promise<PaypalSdk>((resolve, reject) => {
            const script = document.createElement('script');
            const params = new URLSearchParams({ 'client-id': config.clientId!, currency: 'EUR', components: 'buttons', intent: 'capture' });
            script.src = 'https://www.paypal.com/sdk/js?' + params.toString();
            const namespace = config.sandbox ? 'bonzoPayPal' : 'bonzoPayPalLive';
            script.dataset['namespace'] = namespace;
            const timeout = setTimeout(() => { script.remove(); this.sdk = undefined; reject(new Error('PAYPAL_SDK_TIMEOUT')); }, 20_000);
            script.onload = () => {
                clearTimeout(timeout);
                const sdk = (window as unknown as Record<string, PaypalSdk | undefined>)[namespace];
                if (sdk) resolve(sdk);
                else { script.remove(); this.sdk = undefined; reject(new Error('PAYPAL_SDK_UNAVAILABLE')); }
            };
            script.onerror = () => { clearTimeout(timeout); script.remove(); this.sdk = undefined; reject(new Error('PAYPAL_SDK_UNAVAILABLE')); };
            document.head.append(script);
        });
        return this.sdk;
    }
}
