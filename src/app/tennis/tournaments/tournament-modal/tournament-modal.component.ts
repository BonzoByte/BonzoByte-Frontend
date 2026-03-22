/* eslint-disable @typescript-eslint/array-type */
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TournamentIndex } from '@app/core/models/tennis.model';

@Component({
  selector: 'app-tournament-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tournament-modal.component.html',
  styleUrls: ['./tournament-modal.component.scss']
})
export class TournamentModalComponent implements OnInit {
  @Input() tournament: TournamentIndex | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() showMatches = new EventEmitter<number>();

  constructor(private router: Router) {}

  ngOnInit(): void {
    console.log('🟣 TournamentModalComponent ngOnInit', this.tournament);
  }
  
  close(): void {
    this.closed.emit();
  }

  showAllMatches(): void {
    const tpId = this.tournament?.tournamentEventTPId;

    if (!tpId) {
      console.error('❌ showAllMatches: missing tournamentEventTPId', {
        tournament: this.tournament
      });
      return;
    }

    console.log('➡️ Emitting tournament matches request', {
      tpId,
      name: this.tournamentName
    });

    this.showMatches.emit(tpId);
  }

  get tournamentName(): string {
    return this.tournament?.tournamentEventName || 'Tournament';
  }

  get tournamentIso2(): string {
    return this.tournament?.countryISO2 || '';
  }

  get tournamentIso3(): string {
    return this.tournament?.countryISO3 || '';
  }

  get overviewRows(): Array<{ label: string; value: string }> {
    return [
      { label: 'Country', value: this.tournament?.countryFull || '' },
      { label: 'Continent', value: this.tournament?.continentName || '' },
      { label: 'Start', value: this.formatDateMaybe(this.tournament?.tournamentEventDate) },
      { label: 'Level', value: this.tournament?.tournamentLevelName || '' },
      { label: 'Type', value: this.tournament?.tournamentTypeName || '' },
      { label: 'Surface', value: this.tournament?.surfaceName || '' },
      { label: 'Prize', value: this.formatNumMaybe(this.tournament?.prize, 0) },
      { label: 'TS Mean', value: this.formatNumMaybe(this.tournament?.strengthMeanTS, 2) },
      { label: 'TS Players', value: this.formatNumMaybe(this.tournament?.strengthPlayers, 0) },
      { label: 'Matches', value: this.formatNumMaybe(this.tournament?.numberOfMatches, 0) },
      { label: 'Last Match', value: this.formatDateMaybe(this.tournament?.dateOfLastMatch) },
      { label: 'Avg Strength', value: this.formatNumMaybe(this.tournament?.averageMatchStrength, 2) },
      { label: 'Peak Strength', value: this.formatNumMaybe(this.tournament?.peakMatchStrength, 2) }
    ].filter(x => !!x.value);
  }

  flagIso2OrEmpty(iso2?: string | null): string {
    return (iso2 || '').trim().toLowerCase();
  }

  private formatNumMaybe(value?: number | null, digits = 2): string {
    if (value == null || !Number.isFinite(value)) return '';
    return value.toFixed(digits);
  }

  private formatDateMaybe(value?: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }
}