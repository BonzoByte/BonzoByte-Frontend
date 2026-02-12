import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccessibleClickDirective } from '../../../shared/directives/accessible-click.directive';
import { TrapFocusDirective } from '../../../shared/directives/trap-focus.directive';

@Component({
  selector: 'app-player-filter-modal',
  standalone: true,
  templateUrl: './player-filter-modal.component.html',
  imports: [
    CommonModule,
    FormsModule,
    AccessibleClickDirective,
    TrapFocusDirective
  ]
})
export class PlayerFilterModalComponent implements OnInit {
  @Input() activeTournamentTypeIds: number[] = [];

  @Output() filterApplied = new EventEmitter<number[]>();
  @Output() resetFilter = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  tournamentTypes = [
    { _id: 2, type: 'ATP' },
    { _id: 4, type: 'WTA' }
  ];

  selectedTournamentTypeIds: number[] = [];

  ngOnInit(): void {
    this.selectedTournamentTypeIds = [...this.activeTournamentTypeIds];

    // Ako ništa nije aktivno, defaultiraj na oba
    if (this.selectedTournamentTypeIds.length === 0) {
      this.selectedTournamentTypeIds = [2, 4];
    }
  }

  toggleTournamentType(id: number): void {
    const index = this.selectedTournamentTypeIds.indexOf(id);
    if (index > -1) {
      this.selectedTournamentTypeIds.splice(index, 1);
    } else {
      this.selectedTournamentTypeIds.push(id);
    }
  }

  apply(): void {
    this.filterApplied.emit([...this.selectedTournamentTypeIds]);
    this.closed.emit();
  }

  reset(): void {
    this.selectedTournamentTypeIds = [2, 4];
    this.resetFilter.emit();
    this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }
}