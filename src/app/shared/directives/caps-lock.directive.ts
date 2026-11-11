import { Directive, ElementRef, HostListener, OnDestroy, Renderer2 } from '@angular/core';

let nextCapsLockHintId = 0;

/** Reads modifier state only, never the key, password value or form control. */
@Directive({ selector: 'input[appCapsLock]', standalone: true, exportAs: 'capsLock' })
export class CapsLockDirective implements OnDestroy {
  readonly hintId = `bb-caps-lock-hint-${++nextCapsLockHintId}`;
  visible = false;
  private focused = false;

  constructor(private element: ElementRef<HTMLInputElement>, private renderer: Renderer2) {}

  @HostListener('focus') onFocus(): void {
    this.focused = true;
    // Focus alone does not reveal the keyboard state; do not show a stale guess.
    this.setVisible(false);
  }

  @HostListener('blur') onBlur(): void { this.focused = false; this.setVisible(false); }

  @HostListener('keydown', ['$event'])
  @HostListener('keyup', ['$event'])
  onKeyboardEvent(event: KeyboardEvent): void {
    if (!this.focused) return;
    let enabled = false;
    try { enabled = typeof event.getModifierState === 'function' && event.getModifierState('CapsLock'); }
    catch { /* Unsupported virtual keyboards remain usable without a warning. */ }
    this.setVisible(enabled);
  }

  ngOnDestroy(): void { this.focused = false; this.setVisible(false); }

  private setVisible(visible: boolean): void {
    this.visible = visible;
    const input = this.element.nativeElement;
    const current = input.getAttribute('aria-describedby');
    const descriptions = (current ?? '').split(/\s+/)
      .filter(id => id && id !== this.hintId);
    if (visible) descriptions.push(this.hintId);
    const next = descriptions.length ? descriptions.join(' ') : null;
    if (next === current) return;
    if (next !== null) this.renderer.setAttribute(input, 'aria-describedby', next);
    else this.renderer.removeAttribute(input, 'aria-describedby');
  }
}
