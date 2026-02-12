import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccessibleClickDirective } from '../../../shared/directives/accessible-click.directive';
import { TrapFocusDirective } from '../../../shared/directives/trap-focus.directive';

@Component({
  selector: 'app-tournament-filter-modal',
  standalone: true,
  templateUrl: './tournament-filter-modal.component.html',
  imports: [
    CommonModule,
    FormsModule,
    AccessibleClickDirective,
    TrapFocusDirective
  ]
})
export class TournamentFilterModalComponent implements OnChanges {
  @Output() closed = new EventEmitter<void>();
  @Output() filterApplied = new EventEmitter<{ startDate: string | null, endDate: string | null, option: string, surfaceIds: number[], tournamentTypeIds: number[], tournamentLevelIds: number[] }>();
  @Output() resetFilter = new EventEmitter<void>();
  @Output() surfaceFilterChanged = new EventEmitter<number | null>();
  @Output() tournamentTypeFilterChanged = new EventEmitter<number | null>();
  @Output() tournamentLevelFilterChanged = new EventEmitter<number | null>();
  @Input() activeDateFilter = 'all';
  @Input() activeFromDate: string | null = null;
  @Input() activeToDate: string | null = null;
  @Input() activeSurfaceIds: number[] = [];
  @Input() activeTournamentTypeIds: number[] = [];
  @Input() activeTournamentLevelIds: number[] = [];
  @Input() minDate!: Date;
  @Input() maxDate!: Date;

  dateOptions = [
    { label: 'All matches', value: 'all' },
    { label: 'Last year', value: 'year' },
    { label: 'Last month', value: 'month' },
    { label: 'Last week', value: 'week' },
    { label: 'Custom date range', value: 'custom' }
  ];

  surfaces = [
    { _id: 1, surface: 'Indoors' },
    { _id: 2, surface: 'Clay' },
    { _id: 3, surface: 'Grass' },
    { _id: 4, surface: 'Hard' }
  ];

  tournamentTypes = [
    { _id: 2, type: 'ATP' },
    { _id: 4, type: 'WTA' },
  ];

  tournamentLevels = [
    { _id: 1, level: '> 50,000$' },
    { _id: 2, level: 'Cup' },
    { _id: 3, level: 'Qualifications' },
    { _id: 4, level: '< 50,000$' },
  ];

  selectedDateOption = 'all';
  selectedSurfaceIds: number[] = [];
  selectedTournamentTypeIds: number[] = [];
  selectedTournamentLevelIds: number[] = [];
  customFromDate: string | null = null;
  customToDate: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeDateFilter']) {
      this.selectedDateOption = this.activeDateFilter;
    }

    if (this.activeDateFilter === 'custom') {
      this.customFromDate = this.activeFromDate;
      this.customToDate = this.activeToDate;
    } else {
      this.customFromDate = null;
      this.customToDate = null;
    }

    if (changes['activeSurfaceIds']) {
      this.selectedSurfaceIds = [...this.activeSurfaceIds];
    }

    // Osiguraj default
    if (!this.selectedSurfaceIds || this.selectedSurfaceIds.length === 0) {
      this.selectedSurfaceIds = [1, 2, 3, 4];
    }

    if (changes['activeTournamentTypeIds']) {
      this.selectedTournamentTypeIds = [...this.activeTournamentTypeIds];
    }

    if (!this.selectedTournamentTypeIds || this.selectedTournamentTypeIds.length === 0) {
      this.selectedTournamentTypeIds = [2, 4];
    }

    if (changes['activeTournamentLevelIds']) {
      this.selectedTournamentLevelIds = [...this.activeTournamentLevelIds];
    }

    if (!this.selectedTournamentLevelIds || this.selectedTournamentLevelIds.length === 0) {
      this.selectedTournamentLevelIds = [1, 2, 3, 4];
    }
  }

  onDateOptionChange(): void {
    if (this.selectedDateOption !== 'custom') {
      this.customFromDate = null;
      this.customToDate = null;
    }
  }

  onForceOptionChange(value: string) {
    // Omogući klik ako korisnik klikne već aktivnu opciju
    if (this.selectedDateOption === value) {
      this.onDateOptionChange();
    }
  }

  calculateStartDate(option: string): string | null {
    const today = new Date();

    switch (option) {
      case 'year':
        today.setFullYear(today.getFullYear() - 1);
        break;
      case 'month':
        today.setMonth(today.getMonth() - 1);
        break;
      case 'week':
        today.setDate(today.getDate() - 7);
        break;
      case 'all':
      default:
        return null;
    }

    return today.toISOString().split('T')[0];
  }

  close(): void {
    this.closed.emit();
  }

  apply(): void {
    const filter = {
      option: this.selectedDateOption,
      startDate: this.selectedDateOption === 'custom'
        ? this.customFromDate
        : this.calculateStartDate(this.selectedDateOption),
      endDate: this.selectedDateOption === 'custom'
        ? this.customToDate
        : new Date().toISOString().split('T')[0],
      surfaceIds: [...this.selectedSurfaceIds],
      tournamentTypeIds: [...this.selectedTournamentTypeIds],
      tournamentLevelIds: [...this.selectedTournamentLevelIds]
    };
  
    console.log('📤 Emitting filter from modal:', filter);
    this.filterApplied.emit(filter);
  }
  
  toggleSurface(surfaceId: number): void {
    const index = this.selectedSurfaceIds.indexOf(surfaceId);
    if (index > -1) {
      this.selectedSurfaceIds.splice(index, 1);
    } else {
      this.selectedSurfaceIds.push(surfaceId);
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

  toggleTournamentLevel(id: number): void {
    const index = this.selectedTournamentLevelIds.indexOf(id);
    if (index > -1) {
      this.selectedTournamentLevelIds.splice(index, 1);
    } else {
      this.selectedTournamentLevelIds.push(id);
    }
  }

  reset(): void {
    this.selectedDateOption = 'all';
    this.customFromDate = null;
    this.customToDate = null;
    this.selectedSurfaceIds = [1, 2, 3, 4];
    this.selectedTournamentTypeIds = [2, 4];
    this.selectedTournamentLevelIds = [1, 2, 3, 4];
    this.resetFilter.emit();
  }
}