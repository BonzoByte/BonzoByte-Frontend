import { CommonModule } from '@angular/common';
import { Component, Input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-player-summary-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player-summary-card.component.html',
  styleUrls: ['./player-summary-card.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PlayerSummaryCardComponent {
  @Input() playerName = '';
  @Input() countryIso2 = '';
  @Input() countryIso3 = '';
  @Input() countryFull = '';
  @Input() continentName = '';
  @Input() bornText = '';
  @Input() heightText = '';
  @Input() weightText = '';
  @Input() playsText = '';
  @Input() turnedProText = '';
  @Input() avatarUrl = '';
  @Input() genderHint: 'M' | 'W' = 'M';

  flagIso2OrEmpty(iso2: string): string {
    return (iso2 || '').trim().toLowerCase();
  }

  onAvatarError(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    img.src = this.genderHint === 'W'
      ? 'assets/players/default-player-w.png'
      : 'assets/players/default-player-m.png';
  }
}