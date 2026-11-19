import { Injectable, signal } from '@angular/core';

export const MODEL_GUIDANCE_STORAGE_KEY = 'bonzobyte.modelGuidance.visible.v1';

/** Browser-local display choice, shared by guests and signed-in users. No account/API writes. */
@Injectable({ providedIn: 'root' })
export class ModelGuidancePreferenceService {
  private readonly visible = signal(this.read());
  get isVisible(): boolean { return this.visible(); }

  setVisible(visible: boolean): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(MODEL_GUIDANCE_STORAGE_KEY, String(visible));
    } catch { /* Keep the session choice when browser storage is unavailable. */ }
    this.visible.set(visible);
  }

  private read(): boolean {
    try { return typeof localStorage === 'undefined' || localStorage.getItem(MODEL_GUIDANCE_STORAGE_KEY) !== 'false'; }
    catch { return true; }
  }
}
