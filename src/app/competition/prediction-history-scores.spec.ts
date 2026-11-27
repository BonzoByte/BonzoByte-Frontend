import { HttpClient } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { CompetitionService, type CompetitionPick } from '../core/services/competition.service';
import { DiscussionsService } from '../core/services/discussions.service';
import type { MatchSummary } from '../core/models/match-summary';
import { PredictionHistoryGridComponent } from './prediction-history-grid.component';
import { predictionHistoryScores } from './prediction-history-scores';

const now = Date.parse('2026-11-27T09:00:00Z'), day = '20261126';
const scorePath = '/api/provisional-results/' + day, archivePath = '/api/archives/daily/' + day;
function pick(tp = 101, startAt = '2026-11-25T23:10:00Z'): CompetitionPick {
    return {matchTPId:tp, side:1, month:'2026-11', submittedAt:'2026-11-24T22:30:00Z',
        snapshot:{ matchTPId:tp, tournament:'Open', startAt, lockAt:startAt, bookmakers:2, odds:[2.5, 1.4],
            players:[{id:7,name:'A'},{id:8,name:'B'}], model:{version:'frozen',p1:.41,issuedAt:startAt} },
        settlement:{status:'lost', units:-1, reason:'settled', settledAt:'2026-11-27T03:00:00Z'} };
}
const row = (tp = 101): MatchSummary => ({matchTPId:tp, matchId:tp+100, player1TPId:7, player2TPId:8,
    tournamentEventTPId:50, dateTime:'2026-11-26T00:00:00', isFinished:false, qualityStatus:'NotAssessed'});
const packet = (...ids: number[]) => ({schema:'bonzobyte.provisional-results.v1', day, observedAt:'2026-11-27T01:00:00.000Z',
    rows:ids.map(tp => [tp,tp+100,7,8,50,'2:0','7:6(5) 6:3'])});
const daily = (...matches: MatchSummary[]) => ({date:day, count:matches.length, matches});
const read = (responses: Record<string, unknown>) => jasmine.createSpy('read').and.callFake((path: string) =>
    path in responses ? of(responses[path]) : throwError(() => Error('Missing feed')));
const summaries = (...rows: MatchSummary[]) => new Map(rows.map(r => [r.matchTPId, r]));

describe('My Predictions recent scores', () => {
    it('uses Zagreb start day, not UTC or submitted day, and orients both scores to the unchanged pick', async () => {
        const a=pick(), b=pick(102); b.snapshot.players.reverse();
        const saved=JSON.stringify([a,b]), get=read({[scorePath]:packet(101,102)});
        const scores=await firstValueFrom(predictionHistoryScores([a,b],summaries(row(),row(102)),get,()=>now));
        expect(scores.get(101)).toEqual({result:'2:0', sets:'7:6(5) 6:3'});
        expect(scores.get(102)).toEqual({result:'0:2', sets:'6:7(5) 3:6'});
        expect(JSON.stringify([a,b])).toBe(saved);
        expect(get.calls.allArgs()).toEqual([[scorePath]]);
    });
    it('batches missing SQL IDs into a single daily fallback, only after a matching packet', async () => {
        const get=read({[scorePath]:packet(101,102), [archivePath]:daily(row(),row(102))});
        const scores=await firstValueFrom(predictionHistoryScores([pick(),pick(102),pick(103)],
            summaries({...row(),matchId:undefined}),get,()=>now));
        expect([...scores.keys()]).toEqual([101,102]); expect(get.calls.allArgs()).toEqual([[scorePath],[archivePath]]);
    });
    it('never infers from settlement or rescues a contradictory summary with the daily archive', async () => {
        for(const bad of [{matchId:99},{tournamentEventTPId:99},{player1TPId:9},{dateTime:'2026-11-25'},
            {isFinished:true},{result:'20'},{resultDetails:'6:2'},{qualityStatus:'Held'}]) {
            const get=read({[scorePath]:packet(101),[archivePath]:daily(row())});
            const scores=await firstValueFrom(predictionHistoryScores([pick()],summaries({...row(),...bad}),get,()=>now));
            expect(scores.size).toBe(0); expect(get.calls.allArgs()).not.toContain([archivePath]);
        }
        const get=read({}); expect((await firstValueFrom(predictionHistoryScores([pick()],summaries(row()),get,()=>now))).size).toBe(0);
    });
    it('rejects wrong, missing, finished, held or ambiguous canonical rows and malformed daily envelopes', async () => {
        for(const data of [daily({...row(),matchId:555}),daily({...row(),matchTPId:222}), daily({...row(),player2TPId:9}),
            daily({...row(),tournamentEventTPId:12}),daily({...row(),dateTime:'2026-11-25'}),daily({...row(),isFinished:true}),
            daily({...row(),qualityStatus:'Held'}),daily(row(),row()), daily(row(),{...row(102),matchId:201}),
            {...daily(row()),date:'20261125'}, {...daily(row()),count:2501},null]) {
            const scores=await firstValueFrom(predictionHistoryScores([pick()],summaries({...row(),matchId:undefined}),
                read({[scorePath]:packet(101),[archivePath]:data}),()=>now));
            expect(scores.size).toBe(0);
        }
    });
    it('does not request historic, future, ambiguous-start or fixture IDs; isolates unavailable days', async () => {
        const get=read({[scorePath]:packet(101)});
        const entries=[pick(),pick(102,'2026-11-24T22:10:00Z'),pick(103,'2026-11-27T23:10:00Z'),
            pick(104,'2026-11-26T00:10:00'),pick(8000000000000000),pick(106,'2026-11-24T23:10:00Z')];
        const scores=await firstValueFrom(predictionHistoryScores(entries,summaries(row()),get,()=>now));
        expect([...scores.keys()]).toEqual([101]); expect(get.calls.allArgs()).toEqual([[scorePath],['/api/provisional-results/20261125']]);
    });
    it('removes the score at the source-day expiry even if the history page stays open', fakeAsync(() => {
        const times:number[]=[], sub=predictionHistoryScores([pick()],summaries(row()),read({[scorePath]:packet(101)}),
            ()=>Date.parse('2026-11-28T22:59:59.999Z')).subscribe(s=>times.push(s.size));
        tick(1); expect(times).toEqual([1,0]); sub.unsubscribe();
    }));
});

describe('My Predictions result cell wiring', () => {
    const metadata = {cardSummaries: () => of(summaries(row()))};
    let http: {get: ReturnType<typeof read>};
    beforeEach(async () => {
        spyOn(Date,'now').and.returnValue(now);
        http={get:read({[scorePath]:packet(101)})};
        await TestBed.configureTestingModule({imports:[PredictionHistoryGridComponent],providers:[provideTranslateService(),
            {provide:HttpClient,useValue:http},{provide:DiscussionsService,useValue:metadata},
            {provide:CompetitionService,useValue:{canWithdraw:()=>false}}]}).compileComponents();
    });
    it('renders the actual sets separately from the settlement badge; canonical data takes precedence on refresh', () => {
        const f=TestBed.createComponent(PredictionHistoryGridComponent), a=pick();
        f.componentRef.setInput('entries',[a]); f.detectChanges();
        const text=(selector:string)=>f.nativeElement.querySelector(selector)?.textContent.trim();
        expect(text('.shared-result-main')).toBe('2:0'); expect(text('.shared-result-sets')).toBe('7:6(5) 6:3');
        expect(text('.status-icon')).toBe('×'); expect(f.componentInstance.rows[0].match.result).toBeUndefined();
        spyOn(metadata,'cardSummaries').and.returnValue(of(summaries({...row(),isFinished:true,qualityStatus:'Validated',result:'02',resultDetails:'1:6 2:6'})));
        f.componentRef.setInput('entries',[a]); f.detectChanges();
        expect(text('.shared-result-main')).toBe('0:2'); expect(text('.shared-result-sets')).toBe('1:6 2:6');
        expect(http.get.calls.count()).toBe(1); f.destroy();
    });
    it('does not read the score feed for illustrative, retrospective, public or preview histories', () => {
        for (const flag of ['illustrative','retrospective','publicView','localPreview']) {
            const f=TestBed.createComponent(PredictionHistoryGridComponent);
            f.componentRef.setInput(flag,true); f.componentRef.setInput('entries',[pick()]); f.detectChanges();
            expect(f.componentInstance.rows[0].provisional).toBeUndefined(); f.destroy();
        }
        expect(http.get).not.toHaveBeenCalled();
    });
    it('cancels an in-flight lookup when the entries change', () => {
        const pending=new Subject<unknown>(); http.get.and.returnValue(pending);
        const f=TestBed.createComponent(PredictionHistoryGridComponent);
        f.componentRef.setInput('entries',[pick()]); f.detectChanges(); expect(pending.observed).toBeTrue();
        f.componentRef.setInput('entries',[]); f.detectChanges();
        expect(pending.observed).toBeFalse(); expect(f.componentInstance.rows).toEqual([]); f.destroy();
    });
});
