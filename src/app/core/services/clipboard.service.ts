import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';

export type ClipboardResult = 'copied' | 'manual';

/** Writes only on an explicit user action. Never reads or stores clipboard data. */
@Injectable({ providedIn: 'root' })
export class ClipboardService {
  constructor(@Inject(DOCUMENT) private document: Document) {}

  async copy(text: string): Promise<ClipboardResult> {
    if (!text) return 'manual';
    try {
      const clipboard = this.document.defaultView?.navigator.clipboard;
      if (!clipboard?.writeText) return 'manual';
      // Keep the native receiver and invoke immediately, within the user's gesture.
      await clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'manual';
    }
  }
}
