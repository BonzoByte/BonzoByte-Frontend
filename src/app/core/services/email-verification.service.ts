import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { User } from '../models/user.model';

export interface VerificationContext { email?: string; verificationTicket?: string; }
export interface VerificationState {
    verified: boolean; email?: string; serverNow: string;
    expiresAt: string | null; resendAt: string | null; attemptsRemaining: number;
    delivery: 'none' | 'pending' | 'sent' | 'failed';
}
export interface VerificationResult { verified: boolean; token?: string; user?: User; }

@Injectable({ providedIn: 'root' })
export class EmailVerificationService {
    constructor(private http: HttpClient) {}
    status(context: VerificationContext) {
        return this.http.post<VerificationState>(`${environment.apiUrl}/auth/verification-status`, this.credentials(context));
    }
    resend(context: VerificationContext) {
        return this.http.post<VerificationState>(`${environment.apiUrl}/auth/resend-verification`, this.credentials(context));
    }
    verify(context: VerificationContext, code: string) {
        return this.http.post<VerificationResult>(`${environment.apiUrl}/auth/verify-email-code`, { ...this.credentials(context), code });
    }
    private credentials(context: VerificationContext) {
        return context.verificationTicket ? { verificationTicket: context.verificationTicket } : {};
    }
}

export function openEmailVerification(context: VerificationContext = {}): void {
    window.dispatchEvent(new CustomEvent('openVerification', { detail: context }));
}
