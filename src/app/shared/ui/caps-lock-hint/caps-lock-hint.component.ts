import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CapsLockDirective } from '../../directives/caps-lock.directive';

@Component({
  selector: 'app-caps-lock-hint', standalone: true, imports: [CommonModule, TranslateModule],
  host: { '[style.display]': 'field.visible ? "block" : "none"' },
  template: `<p *ngIf="field.visible" [id]="field.hintId" class="bb-caps-lock-hint"
    role="status" aria-live="polite" aria-atomic="true">
    <span aria-hidden="true">⇪</span>{{ 'auth.capsLockOn' | translate }}
  </p>`,
  styles: [`.bb-caps-lock-hint { display: flex; align-items: baseline; gap: 6px; margin: 6px 0 0;
    padding-inline-start: 8px; border-inline-start: 2px solid var(--bb-theme-accent);
    color: var(--bb-text-muted); font-size: .9em; line-height: 1.4; overflow-wrap: anywhere; }
    .bb-caps-lock-hint span { flex-shrink: 0; }`]
})
export class CapsLockHintComponent {
  @Input({ required: true }) field!: CapsLockDirective;
}
