import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, HostListener, Inject, Input, NgZone, OnDestroy, OnInit } from '@angular/core';
import { lockModalScroll } from './modal-scroll-lock';

const traps: TrapFocusDirective[] = [];

/** Only the topmost dialog owns keyboard input and focus restoration. */
@Directive({ selector: '[appTrapFocus]', standalone: true })
export class TrapFocusDirective implements OnInit, OnDestroy {
  @Input() onEscape?: () => void;
  @Input() lockBackgroundScroll = true;
  private opener: HTMLElement | null = null;
  private focusTimer?: ReturnType<typeof setTimeout>;
  private originalTabIndex: string | null = null;
  private releaseScroll?: () => void;
  private get root(): HTMLElement { return this.elRef.nativeElement; }
  private get isTop(): boolean { return traps[traps.length - 1] === this; }
  constructor(private elRef: ElementRef<HTMLElement>, @Inject(DOCUMENT) private document: Document, private zone: NgZone) {}

  ngOnInit(): void {
    this.opener = this.document.activeElement as HTMLElement | null;
    this.originalTabIndex = this.root.getAttribute('tabindex');
    if (this.originalTabIndex === null) this.root.tabIndex = -1;
    traps.push(this);
    if (this.lockBackgroundScroll) this.releaseScroll = this.zone.runOutsideAngular(() => lockModalScroll(this.root, this.document));
    this.focusTimer = setTimeout(() => { if (this.isTop && this.root.isConnected) this.focusFirst(); });
  }
  ngOnDestroy(): void {
    clearTimeout(this.focusTimer);
    const wasTop = this.isTop;
    const index = traps.indexOf(this); if (index >= 0) traps.splice(index, 1);
    this.releaseScroll?.();
    if (this.originalTabIndex === null) this.root.removeAttribute('tabindex');
    queueMicrotask(() => {
      if (!wasTop) return;
      const top = traps[traps.length - 1];
      if (this.opener?.isConnected && !this.opener.matches(':disabled') && (!top || top.root.contains(this.opener)))
        this.opener.focus({ preventScroll: true });
      else if (top && !top.root.contains(this.document.activeElement)) top.focusFirst();
    });
  }
  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (!this.isTop || event.defaultPrevented || event.isComposing) return;
    if (event.key === 'Escape' && this.onEscape) {
      event.preventDefault(); event.stopImmediatePropagation(); this.onEscape(); return;
    }
    if (event.key !== 'Tab') return;
    const elements = this.focusable(), first = elements[0], last = elements[elements.length - 1];
    const active = this.document.activeElement;
    if (!first) { event.preventDefault(); this.root.focus({ preventScroll: true }); }
    else if (!this.root.contains(active) || active === this.root || (event.shiftKey ? active === first : active === last)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true });
    }
  }
  private focusable(): HTMLElement[] {
    return Array.from(this.root.querySelectorAll<HTMLElement>('a[href],button,textarea,input,select,[tabindex]'))
      .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[hidden],[inert]') &&
        el.getClientRects().length > 0 && this.document.defaultView?.getComputedStyle(el).visibility !== 'hidden');
  }
  private focusFirst(): void { (this.focusable()[0] ?? this.root).focus({ preventScroll: true }); }
}
