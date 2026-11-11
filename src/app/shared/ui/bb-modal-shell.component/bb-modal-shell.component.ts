import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { TrapFocusDirective } from '../../directives/trap-focus.directive';

let bbModalIdCounter = 0;
let bbModalScrollLocks = 0;

@Component({
  selector: 'app-bb-modal-shell',
  standalone: true,
  imports: [CommonModule, TrapFocusDirective],
  templateUrl: './bb-modal-shell.component.html',
  styleUrls: ['./bb-modal-shell.component.scss']
})
export class BbModalShellComponent implements OnInit, OnDestroy {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() closeLabel = 'Close';
  @Input() closeOnEsc = true;
  @Input() closeDisabled = false;
  onEscape = (): void => { if (this.closeOnEsc) this.close(); };

  /** Extra classes appended to .bb-modal (e.g. 'bb-filter-modal', 'bb-modal--billing') */
  @Input() modalClass = '';

  /** If true, clicking backdrop closes modal */
  @Input() closeOnBackdrop = false;

  /** If true, adds body.modal-open while modal exists */
  @Input() lockBodyScroll = true;

  @Output() closed = new EventEmitter<void>();

  readonly titleId = `bb-modal-title-${++bbModalIdCounter}`;
  private acquiredScrollLock = false;

  ngOnInit(): void {
    if (this.lockBodyScroll) {
      this.acquiredScrollLock = true;
      bbModalScrollLocks++;
      document.body.classList.add('modal-open');
    }
  }

  ngOnDestroy(): void {
    if (this.acquiredScrollLock && --bbModalScrollLocks === 0) document.body.classList.remove('modal-open');
    this.acquiredScrollLock = false;
  }

  close = (): void => {
    if (!this.closeDisabled) this.closed.emit();
  };

  onBackdropClick(): void {
    if (this.closeOnBackdrop) this.close();
  }

  get modalClassList(): string {
    const extras = (this.modalClass || '')
      .split(' ')
      .map(x => x.trim())
      .filter(Boolean);

    return ['bb-modal', ...extras].join(' ');
  }
}
