import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { MatchSummary } from '../../core/models/match-summary';
import { RegionalSettingsService } from '../../core/services/regional-settings.service';
import { playerGridFlagCode, playerGridLabel } from '../../core/helpers/player-grid-label';
import { matchLinkOverview } from './match-link-overview';

@Component({ selector: 'app-match-link-overview', standalone: true, imports: [CommonModule, TranslateModule],
    templateUrl: './match-link-overview.component.html', styleUrls: ['./match-link-overview.component.scss'] })
export class MatchLinkOverviewComponent implements OnChanges {
    @Input({ required: true }) match!: MatchSummary;
    view!: ReturnType<typeof matchLinkOverview>;
    readonly flag = playerGridFlagCode;
    readonly playerLabel = playerGridLabel;
    constructor(readonly regional: RegionalSettingsService) {}
    ngOnChanges(): void { this.view = matchLinkOverview(this.match); }
    dateLabel(): string { return this.regional.matchDateTime(this.match.dateTime, this.match.sourceTimePrecision).replace(/ (\d{2}:\d{2})$/, '\n$1') || '—'; }
    roundLabel(): string {
        const raw = this.match.roundName?.trim() ?? '';
        const key = raw.toLowerCase().replace(/[\s_-]/g, '');
        if (/^semifinals?$/.test(key)) return 'SF';
        if (/^quarterfinals?$/.test(key)) return 'QF';
        if (/^finals?$/.test(key)) return 'F';
        const round = /^(?:roundof|round)(\d+)$/.exec(key);
        return round ? 'R' + round[1] : raw || '—';
    }
    surface(): string {
        const value = this.match.surface?.trim() ?? '';
        if (!value || /^(unknown|unk|n\/a|na|none|-|0)$/i.test(value)) return '';
        const key = value.toLowerCase();
        return ['clay', 'hard', 'grass', 'carpet', 'indoor'].includes(key) ? this.regional.text('surfaces.' + key) : value;
    }
    signed(value: number): string { return (value > 0 ? '+' : '') + this.regional.number(value, 1); }
}
