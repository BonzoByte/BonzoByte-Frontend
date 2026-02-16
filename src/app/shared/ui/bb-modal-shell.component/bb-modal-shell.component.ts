import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';

let bbModalIdCounter = 0;

@Component({
  selector: 'app-bb-modal-shell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bb-modal-shell.component.html',
  styleUrls: ['./bb-modal-shell.component.scss']
})
export class BbModalShellComponent implements OnInit, OnDestroy {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;

  /** Extra classes appended to .bb-modal (e.g. 'bb-filter-modal', 'bb-modal--billing') */
  @Input() modalClass = '';

  /** If true, clicking backdrop closes modal */
  @Input() closeOnBackdrop = true;

  /** If true, adds body.modal-open while modal exists */
  @Input() lockBodyScroll = true;

  @Output() closed = new EventEmitter<void>();

  readonly titleId = `bb-modal-title-${++bbModalIdCounter}`;

  ngOnInit(): void {
    if (this.lockBodyScroll) document.body.classList.add('modal-open');
  }

  ngOnDestroy(): void {
    if (this.lockBodyScroll) document.body.classList.remove('modal-open');
  }

  close = (): void => {
    this.closed.emit();
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