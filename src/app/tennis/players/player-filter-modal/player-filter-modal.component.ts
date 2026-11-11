import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RegionalSettingsService } from '../../../core/services/regional-settings.service';
import { BbModalShellComponent } from '../../../shared/ui/bb-modal-shell.component/bb-modal-shell.component';

export type PlayerTsAvailability = 'all' | 'with' | 'without';

export interface PlayerFilterState {
  countryISO3: string;
  minimumMatches: number;
  tsAvailability: PlayerTsAvailability;
  activityMonths: number | null;
}

export interface PlayerCountryOption {
  iso3: string;
  name: string;
}

export const DEFAULT_PLAYER_FILTER: PlayerFilterState = {
  countryISO3: '',
  minimumMatches: 0,
  tsAvailability: 'all',
  activityMonths: null
};

@Component({
  selector: 'app-player-filter-modal',
  standalone: true,
  templateUrl: './player-filter-modal.component.html',
  imports: [CommonModule, FormsModule, BbModalShellComponent, TranslateModule]
})
export class PlayerFilterModalComponent implements OnChanges {
  @Input() activeFilter: PlayerFilterState = { ...DEFAULT_PLAYER_FILTER };
  @Input() countries: PlayerCountryOption[] = [];

  @Output() filterApplied = new EventEmitter<PlayerFilterState>();
  @Output() resetFilter = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  draft: PlayerFilterState = { ...DEFAULT_PLAYER_FILTER };

  constructor(public regional: RegionalSettingsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeFilter']) {
      this.draft = { ...DEFAULT_PLAYER_FILTER, ...this.activeFilter };
    }
  }

  apply(): void {
    this.filterApplied.emit({ ...this.draft });
    this.closed.emit();
  }

  reset(): void {
    this.draft = { ...DEFAULT_PLAYER_FILTER };
    this.resetFilter.emit();
    this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }
}
