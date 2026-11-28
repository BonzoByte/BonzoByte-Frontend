import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, combineLatest, map, Observable, of, startWith } from 'rxjs';
import type { Match } from '../../../core/models/tennis.model';
import { StaticArchivesService } from '../../../core/services/static-archives.service';
import { RegionalSettingsService } from '../../../core/services/regional-settings.service';
import { fixtureForm } from '../../../core/helpers/fixture-form';
import { modelDecimalOdds } from '../../../core/helpers/model-odds';
import { RecentMatchesComponent } from '../../../shared/ui/recent-matches/recent-matches.component';

@Component({selector:'app-fixture-preview',standalone:true,imports:[CommonModule,TranslateModule,RecentMatchesComponent],
template:`
  <h3 *ngIf="section!=='h2h'">{{ 'matchDetails.fixtureForm' | translate }}</h3>
  <ng-container *ngIf="history$ | async as h"><div class="sides" *ngIf="section!=='h2h'">
    <section *ngFor="let side of h.sides">
      <strong>{{ side.name }}</strong><small *ngIf="side.country || side.rank"> {{ side.country }} <ng-container *ngIf="side.rank">· #{{ side.rank }}</ng-container></small>
      <p *ngIf="side.odds != null">{{ 'matchDetails.fixtureOdds' | translate }}: {{ regional.number(side.odds,2) }}</p>
      <p *ngIf="side.rows === undefined">{{ 'common.loading' | translate }}</p>
      <p *ngIf="side.rows === null">{{ 'matchDetails.historyUnavailable' | translate }}</p>
      <p *ngIf="side.rows?.length===0">{{ 'matchDetails.noEarlier' | translate }}</p>
      <app-recent-matches *ngIf="side.recent?.length" scope="player" [entityId]="side.playerId" [selectedHistory]="side.recent"></app-recent-matches>
    </section>
  </div>
  <ng-container *ngIf="section!=='form'"><p *ngIf="h.h2h as total; else noMeetings"><strong>{{ 'matchDetails.fixtureH2h' | translate }}:</strong> {{ total[0] }} – {{ total[1] }}</p>
    <ng-template #noMeetings><p>{{ (h.sides[0].rows===undefined || h.sides[1].rows===undefined ? 'common.loading' : 'matchDetails.historyUnavailable') | translate }}</p></ng-template></ng-container></ng-container>
  `,styles:[`.sides{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:1rem}
    section{min-width:0} small{margin-inline-start:.3rem} p{margin:.4rem 0}`]})
export class FixturePreviewComponent implements OnChanges {
    @Input() match!:Partial<Match>;
    @Input() section:'all'|'form'|'h2h'='all';
    constructor(private archive:StaticArchivesService,public regional:RegionalSettingsService){}
    history$?:Observable<{sides:{playerId:number;name?:string;country?:string;rank?:string|number;odds:number|null;rows:ReturnType<typeof fixtureForm>|null|undefined;recent?:Match[]}[];h2h:number[]|null}>;
    ngOnChanges(){
        const m=this.match, ids=[m.player1TPId,m.player2TPId], before=m.dateTime?.slice(0,10);
        if(!before||!ids[0]||!ids[1]||ids[0]===ids[1]){this.history$=undefined;return;}
        const streams=ids.map((id,i)=>this.archive.getPlayerMatches(id!).pipe(
            map(rows=>fixtureForm(rows,id!,before,m.matchTPId!)),catchError(()=>of(null)),startWith(undefined),
            map(rows=>({playerId:id!,recent:rows?.slice(0,5).map(row=>row.match),name:i?m.player2Name:m.player1Name,country:i?m.player2CountryISO3:m.player1CountryISO3,
                rank:i?m.player2Rank:m.player1Rank,odds:modelDecimalOdds(i?m.modelProbabilityPlayer2:m.modelProbabilityPlayer1,'percent'),rows}))));
        this.history$=combineLatest(streams).pipe(map(sides=>{
            // One consistent orientation; never count the same meeting twice across player archives.
            const i=sides[0].rows?0:1, h=sides[i].rows?.filter(row=>row.opponentId===ids[1-i]);
            return {sides,h2h:h ? [h.filter(r=>r.won===(i===0)).length,h.filter(r=>r.won!==(i===0)).length] : null};
        }));
    }
}
