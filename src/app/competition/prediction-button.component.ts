import { Component, Input, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CompetitionService } from '../core/services/competition.service';

@Component({ selector: 'app-prediction-button', standalone: true, imports: [TranslateModule],
    template: `<button type="button" class="prediction-pick-button" [class.is-picked]="service.picks().has(matchId)"
        [disabled]="finished && !service.picks().has(matchId)" [attr.aria-pressed]="service.picks().has(matchId)"
        [attr.aria-label]="(service.picks().has(matchId) ? 'competition.viewPick' : finished ? 'competition.locked' : 'competition.makePick') | translate"
        [title]="(service.picks().has(matchId) ? 'competition.viewPick' : finished ? 'competition.locked' : 'competition.makePick') | translate"
        (click)="$event.stopPropagation(); service.open(matchId)">{{ service.picks().has(matchId) ? '✓' : '◎' }}</button>`,
    styles: [`.prediction-pick-button {min-width:32px;min-height:32px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--bb-text);font-size:20px;}
        .prediction-pick-button:hover:not(:disabled),.prediction-pick-button:focus-visible {border-color:var(--bb-accent,#80d5ff);}
        .prediction-pick-button.is-picked {color:var(--bb-accent,#80d5ff);} .prediction-pick-button:disabled {opacity:.3;}`] })
export class PredictionButtonComponent implements OnInit {
    @Input() matchId = 0;
    @Input() finished = false;
    constructor(public service: CompetitionService) {}
    ngOnInit(): void { this.service.ensureIndex(); }
}
