import { Component, Input } from '@angular/core';

/** A selectable fallback inside the current dialog, never a hidden DOM copy hack. */
@Component({
  selector: 'app-manual-copy', standalone: true,
  template: `<label>{{ label }}
    <input type="text" readonly [value]="value" [attr.aria-label]="accessibleLabel"
      autocomplete="off" spellcheck="false" (focus)="select($event)" (click)="select($event)" />
  </label>`,
  styles: [`:host { display: block; min-width: 0; max-width: 100%; font: inherit; }
    label { display: block; margin: 0; font: inherit; }
    input { box-sizing: border-box; display: block; width: 100%; min-width: 0;
      margin-top: 4px; font: inherit; }
    input:focus-visible { outline: 2px solid var(--bb-accent, #8edcff); outline-offset: 3px; }`],
})
export class ManualCopyComponent {
  @Input({ required: true }) value!: string;
  @Input({ required: true }) label!: string;
  @Input({ required: true }) accessibleLabel!: string;

  select(event: Event): void { (event.target as HTMLInputElement).select(); }
}
