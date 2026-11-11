import { Injectable } from '@angular/core';
import { DEMO_AD_LAYOUT } from '../helpers/demo-ad-layout';

export const DEMO_AD_DISMISSAL_STORAGE_KEY = 'bonzobyte.demoAds.dismissed.v1';

/** Demo placement preferences only: tab-session scoped, never paid account rights. */
@Injectable({ providedIn: 'root' })
export class DemoAdDismissalService {
    private readonly dismissed = this.read();

    isDismissed(slot: number): boolean { return this.dismissed.has(slot); }

    dismiss(slot: number): void {
        if (!this.isValidSlot(slot)) return;
        this.dismissed.add(slot);
        try {
            if (typeof sessionStorage !== 'undefined')
                sessionStorage.setItem(DEMO_AD_DISMISSAL_STORAGE_KEY, JSON.stringify([...this.dismissed]));
        } catch { /* Retain the in-memory preference when storage is unavailable. */ }
    }

    private read(): Set<number> {
        try {
            const saved: unknown = typeof sessionStorage === 'undefined' ? []
                : JSON.parse(sessionStorage.getItem(DEMO_AD_DISMISSAL_STORAGE_KEY) ?? '[]');
            return new Set(Array.isArray(saved) ? saved.filter(value => this.isValidSlot(value)) : []);
        } catch { return new Set(); }
    }

    private isValidSlot(value: unknown): value is number {
        return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= DEMO_AD_LAYOUT.maxSlots;
    }
}
