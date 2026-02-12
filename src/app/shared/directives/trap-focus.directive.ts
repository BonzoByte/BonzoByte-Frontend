import {
    Directive,
    ElementRef,
    HostListener,
    Input,
    OnInit
} from '@angular/core';
  
  @Directive({
    selector: '[appTrapFocus]',
    standalone: true
  })
  export class TrapFocusDirective implements OnInit {
    @Input() onEscape!: () => void; // callback za ESC
  
    private focusableEls: HTMLElement[] = [];
    private firstEl!: HTMLElement;
    private lastEl!: HTMLElement;
  
    constructor(private elRef: ElementRef) {}
  
    ngOnInit(): void {
      this.setFocusableElements();
      setTimeout(() => this.firstEl?.focus(), 0);
    }
   
    @HostListener('keydown', ['$event'])
    handleKeydown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && this.onEscape) {
        this.onEscape();
        return;
      }
  
      if (event.key !== 'Tab') return;
  
      this.setFocusableElements();
      const active = document.activeElement;
  
      if (event.shiftKey) {
        // Shift + Tab
        if (active === this.firstEl) {
          event.preventDefault();
          this.lastEl?.focus();
        }
      } else {
        // Tab
        if (active === this.lastEl) {
          event.preventDefault();
          this.firstEl?.focus();
        }
      }
    }
  
    private setFocusableElements(): void {
      const root: HTMLElement = this.elRef.nativeElement;
      const selectors = 'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])';
      this.focusableEls = Array.from(root.querySelectorAll<HTMLElement>(selectors));
      this.firstEl = this.focusableEls[0];
      this.lastEl = this.focusableEls[this.focusableEls.length - 1];
    }
  }  