import { Directive, ElementRef, EventEmitter, HostListener, Output, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appAccessibleClick]',
  standalone: true
})
export class AccessibleClickDirective {
  @Output() accessibleClick = new EventEmitter<MouseEvent>();

  constructor(private el: ElementRef, private renderer: Renderer2) {
    this.renderer.setAttribute(this.el.nativeElement, 'tabindex', '0');
    this.renderer.setAttribute(this.el.nativeElement, 'role', 'button');
  }

  @HostListener('click')
  onClick(): void {
    this.accessibleClick.emit();
  }

  @HostListener('keydown.enter')
  @HostListener('keydown.space')
  onKeydown(): void {
    this.accessibleClick.emit();
  }
}