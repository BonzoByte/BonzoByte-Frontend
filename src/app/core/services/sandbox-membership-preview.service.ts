import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Entitlements } from '../models/user.model';
import { environment } from '../../../environments/environment';

export interface SandboxMembershipPreview {
    sandbox: true;
    realMembershipChanged: false;
    serverNow: string;
    durationSeconds: number;
    state: 'unavailable' | 'ready' | 'active' | 'expired';
    orderId: string | null;
    plan: string | null;
    startedAt: string | null;
    endsAt: string | null;
    actual: Entitlements;
    simulated: Entitlements;
}

@Injectable({ providedIn: 'root' })
export class SandboxMembershipPreviewService {
    constructor(private http: HttpClient) {}
    status() { return this.http.get<SandboxMembershipPreview>(`${environment.apiUrl}/billing/membership-preview`); }
    start(orderId: string) {
        return this.http.post<SandboxMembershipPreview>(
            `${environment.apiUrl}/billing/orders/${encodeURIComponent(orderId)}/membership-preview`, {});
    }
}
