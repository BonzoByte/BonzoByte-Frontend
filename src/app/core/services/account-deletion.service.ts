import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
export type DeletionState = 'not_found' | 'queued' | 'app_erased' | 'complete';
const RECEIPT_KEY = 'bonzobyte.deletion.receipt.v1';
export function savedDeletionReceipt(): string | null {
    try { const value = JSON.parse(sessionStorage.getItem(RECEIPT_KEY) || 'null'); return /^[a-f0-9]{64}$/.test(value?.receipt) ? value.receipt : null; } catch { return null; }
}
export function savedDeletionOwner(): string | undefined {
    try { return JSON.parse(sessionStorage.getItem(RECEIPT_KEY) || 'null')?.userId; } catch { return undefined; }
}
@Injectable({ providedIn: 'root' })
export class AccountDeletionService {
    private readonly base = environment.apiUrl + '/users/me/deletion';
    constructor(private http: HttpClient) {}
    config() { return this.http.get<{ available: boolean }>(this.base + '/config'); }
    requestCode(language: string) { return this.http.post<{ challenge: string; expiresAt: string; resendAt: string }>(this.base + '/code', { language }); }
    confirm(input: { challenge: string; code: string; confirm: boolean; reason: string; receipt: string }) {
        return this.http.post<{ state: DeletionState }>(this.base + '/confirm', input);
    }
    status(receipt: string) { return this.http.post<{ state: DeletionState }>(this.base + '/status', { receipt }); }
    newReceipt(): string { return Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join(''); }
    remember(receipt: string, userId?: string) { try { sessionStorage.setItem(RECEIPT_KEY, JSON.stringify({ receipt, userId })); } catch { /* This tab can still finish. */ } }
    forget() { try { sessionStorage.removeItem(RECEIPT_KEY); } catch { /* Browser blocks storage. */ } }
}
