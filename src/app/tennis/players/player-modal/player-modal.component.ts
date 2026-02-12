import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-player-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player-modal.component.html'
})
export class PlayerModalComponent {
  @Input() playerTPId!: number;
  @Output() closed = new EventEmitter<void>();
  
  close() {
    this.closed.emit();
  }
}