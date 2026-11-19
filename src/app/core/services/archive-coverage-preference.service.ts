import { Injectable, signal } from '@angular/core';

export const ARCHIVE_COVERAGE_STORAGE_KEY = 'bonzobyte.archiveCoverage.visible.v1';

/** One browser-local choice for guests and signed-in visitors; no account/API writes. */
@Injectable({ providedIn: 'root' })
export class ArchiveCoveragePreferenceService {
    private readonly visible = signal(this.read());
    get isVisible(): boolean { return this.visible(); }

    dismiss(): void {
        try {
            if (typeof localStorage !== 'undefined') localStorage.setItem(ARCHIVE_COVERAGE_STORAGE_KEY, 'false');
        } catch { /* Still dismiss for this visit when browser storage is unavailable. */ }
        this.visible.set(false);
    }

    private read(): boolean {
        try { return typeof localStorage === 'undefined' || localStorage.getItem(ARCHIVE_COVERAGE_STORAGE_KEY) !== 'false'; }
        catch { return true; }
    }
}
