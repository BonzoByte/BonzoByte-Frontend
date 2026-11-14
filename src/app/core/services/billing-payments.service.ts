import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Entitlements } from '../models/user.model';

export type BillingFulfillment = 'preview-only' | 'isolated-lab' | 'sandbox-plans' | 'live-plans';
export interface BillingCapabilities { history: boolean; reconcile: boolean; refund: boolean;
    membershipPreview: boolean; activatesMembership: boolean; livePayments: boolean; }
export interface BillingPayment { orderId: string; plan: string; status: string; amount: string; currency: string;
    grantEndsAt: string | null; revokedAt: string | null; refundStatus: string | null; capturePending?: boolean; }
export interface BillingStatus { sandbox: boolean; fulfillment: BillingFulfillment; capabilities: BillingCapabilities;
    entitlements: Entitlements; payments: BillingPayment[]; }
export interface BillingRefundConfirmation { payment: BillingPayment; entitlements: Entitlements; }

@Injectable({ providedIn: 'root' })
export class BillingPaymentsService {
    constructor(private http: HttpClient) {}
    status() { return this.http.get<BillingStatus>(`${environment.apiUrl}/billing/payments`); }
    reconcile(orderId: string) { return this.http.post<BillingStatus>(`${environment.apiUrl}/billing/orders/${encodeURIComponent(orderId)}/reconcile`, {}); }
    refund(orderId: string) { return this.http.post<BillingStatus>(`${environment.apiUrl}/billing/orders/${encodeURIComponent(orderId)}/refund`, {}); }
}
