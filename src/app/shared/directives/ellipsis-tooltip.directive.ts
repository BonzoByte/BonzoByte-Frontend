import { AfterViewInit, Directive, ElementRef, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appEllipsisTooltip]',
  standalone: true
})
export class EllipsisTooltipDirective implements AfterViewInit {

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngAfterViewInit(): void {
    const element = this.el.nativeElement;

    // Delay od 0ms da Angular završi rendering
    setTimeout(() => {
      if (element.scrollWidth > element.clientWidth) {
        this.renderer.setAttribute(element, 'title', element.textContent.trim());
        this.renderer.setStyle(element, 'text-overflow', 'ellipsis');
        this.renderer.setStyle(element, 'overflow', 'hidden');
        this.renderer.setStyle(element, 'white-space', 'nowrap');
      }
    }, 0);
  }
}