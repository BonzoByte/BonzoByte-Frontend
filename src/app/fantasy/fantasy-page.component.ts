import { CommonModule } from '@angular/common';
import { Component,Input,OnDestroy,OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subject,Subscription,debounceTime,takeUntil } from 'rxjs';
import { LocalizedSnackbarService } from '../core/i18n/localized-snackbar.service';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../core/services/auth.service';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import { DraftUnloadGuardService } from '../core/services/draft-unload-guard.service';
import { LoginComponent } from '../auth/login/login.component';
import { FantasyService } from './fantasy.service';
import { FantasyStatus,FantasyMine,FantasyBoard,FantasyMarket,FantasyPlayer,FantasyPublicTeam,fantasyCost,fantasyChanged,fantasyDraftProblem,fantasyBudgetSummary,FANTASY_BUDGET } from './fantasy.models';

@Component({selector:'app-fantasy-page',standalone:true,imports:[CommonModule,FormsModule,TranslateModule,LoginComponent,MatSnackBarModule,RouterLink],
  templateUrl:'./fantasy-page.component.html',styleUrls:['./fantasy-page.component.scss']})
export class FantasyPageComponent implements OnInit,OnDestroy {
  @Input() leaderboardOnly=false;
  @Input() initialMonth='';
  readonly Math=Math;
  readonly totalBudget=FANTASY_BUDGET;
  tab:'team'|'market'|'leaderboard'|'rules'='team';
  status:FantasyStatus|null=null; mine:FantasyMine|null=null; board:FantasyBoard|null=null; market:FantasyMarket|null=null;
  publicTeam:FantasyPublicTeam|null=null; publicLoading=false;
  readonly players=new Map<number,FantasyPlayer>(); draft:number[]=[]; name=''; month=''; tour=''; query=''; page=0;
  loading=false; marketLoading=false; mineLoading=false; saving=false; error=''; mineError=''; marketError=false; boardError=false; boardLoading=false;
  stale=false; showLogin=false; actor=''; verified=false; readonly tabs=['team','market','rules'] as const;
  private readonly destroy=new Subject<void>(); private readonly contextChanged=new Subject<void>(); private readonly searches=new Subject<void>();
  private statusRequest?:Subscription;private marketRequest?:Subscription;private releaseUnload:()=>void;
  constructor(readonly service:FantasyService,readonly auth:AuthService,readonly regional:RegionalSettingsService,
    private toast:LocalizedSnackbarService,private unload:DraftUnloadGuardService){this.releaseUnload=unload.register(()=>this.dirty);}
  get dirty():boolean {return fantasyChanged(this.draft,this.mine?.team?.plannedPlayers??[])||this.name!==(this.mine?.team?.name??'');}
  get cost():number{return fantasyCost(this.draft,this.players);}
  get budget(){return fantasyBudgetSummary(this.draft,this.players);}
  get problem():string|null{return this.name.trim().length<2?'fantasy.nameRequired':fantasyDraftProblem(this.draft,this.players);}
  get selectedPlayers():FantasyPlayer[]{return this.draft.map(id=>this.players.get(id)).filter((p):p is FantasyPlayer=>!!p);}
  count(tour:string):number{return this.selectedPlayers.filter(p=>p.tour===tour).length;}
  get editable():boolean {return this.status?.season?.status==='open'&&!!this.actor&&this.verified&&!this.mineLoading&&!this.mineError&&!this.stale&&!this.saving;}
  get scheduledDay():string {const s=this.status?.season;if(!s)return '';const now=this.status!.serverTime;return now<s.start?s.start.slice(0,10):new Date(Date.parse(now.slice(0,10)+'T00:00:00Z')+86400000).toISOString().slice(0,10);}
  ngOnInit():void {
    if(this.leaderboardOnly){this.tab='leaderboard';if(/^20\d{2}-(0[1-9]|1[0-2])$/.test(this.initialMonth))this.month=this.initialMonth;}
    this.auth.user$.pipe(takeUntil(this.destroy)).subscribe(user=>{
      const actor=user?._id??'';this.verified=user?.isVerified===true;if(actor===this.actor)return;
      this.actor=actor;this.contextChanged.next();this.mine=null;this.draft=[];this.name='';this.saving=false;this.mineLoading=false;this.stale=false;this.mineError='';this.unload.refresh();
      if(this.month&&actor&&!this.leaderboardOnly)this.loadMine();
      if(this.month&&this.leaderboardOnly)this.loadBoard();
    });
    this.searches.pipe(debounceTime(250),takeUntil(this.destroy)).subscribe(()=>this.loadMarket());this.load();
  }
  load():void {
    if(this.loading)return;this.loading=true;this.error='';this.statusRequest?.unsubscribe();
    this.statusRequest=this.service.status(this.month||undefined).pipe(takeUntil(this.destroy)).subscribe({next:s=>{
      this.status=s;this.loading=false;if(!s.season)return;this.month=s.season.month;
      if(this.leaderboardOnly)this.loadBoard();else {this.loadMarket();if(this.actor)this.loadMine();}
    },error:()=>{this.loading=false;this.error='fantasy.unavailable';}});
  }
  changeMonth(month:string):void {
    if(!this.canLeave())return;this.contextChanged.next();this.marketRequest?.unsubscribe();this.month=month;this.mine=null;this.draft=[];this.name='';this.market=null;this.board=null;this.players.clear();this.page=0;this.stale=false;this.mineError='';this.publicTeam=null;this.saving=false;this.mineLoading=false;this.unload.refresh();this.load();
  }
  loadMine():void {
    if(!this.month||!this.actor)return;this.mineLoading=true;this.mineError='';
    this.service.mine(this.month).pipe(takeUntil(this.contextChanged),takeUntil(this.destroy)).subscribe({next:m=>{
      this.mine=m;for(const p of m.players)this.players.set(p.playerId,p);this.draft=[...(m.team?.plannedPlayers??[])];this.name=m.team?.name??'';
      this.mineLoading=false;this.stale=false;this.unload.refresh();
    },error:()=>{this.mineLoading=false;this.mineError='fantasy.privateUnavailable';}});
  }
  search():void {this.page=0;this.searches.next();}
  loadMarket():void {
    if(!this.month)return;this.marketRequest?.unsubscribe();this.marketLoading=true;this.marketError=false;
    this.marketRequest=this.service.market(this.month,this.tour,this.query.slice(0,80),this.page).pipe(takeUntil(this.destroy)).subscribe({next:m=>{
      if(m.catalogueSha!==this.status?.season?.catalogueSha){this.marketError=true;this.marketLoading=false;return;}
      this.market=m;for(const p of m.items)this.players.set(p.playerId,p);this.marketLoading=false;
    },error:()=>{this.marketLoading=false;this.marketError=true;}});
  }
  turnPage(delta:number):void {this.page+=delta;this.loadMarket();}
  toggle(p:FantasyPlayer):void {
    if(!this.editable)return;
    if(this.draft.includes(p.playerId))this.draft=this.draft.filter(id=>id!==p.playerId);
    else {if(this.count(p.tour)>=5||this.cost+p.price>1000000)return;this.draft=[...this.draft,p.playerId];}
    this.unload.refresh();
  }
  changeName():void{this.unload.refresh();}
  discard():void {if(!this.canLeave())return;this.draft=[...(this.mine?.team?.plannedPlayers??[])];this.name=this.mine?.team?.name??'';this.unload.refresh();}
  cancelPending():void {if(!this.editable||!this.mine?.team?.currentPlayers.length)return;this.draft=[...this.mine.team.currentPlayers];this.unload.refresh();}
  save():void {
    if(!this.editable||this.problem||!this.dirty)return;this.saving=true;this.mineError='';
    this.service.save(this.month,[...this.draft],this.mine?.team?.revision??0,this.name.trim()).pipe(takeUntil(this.contextChanged),takeUntil(this.destroy)).subscribe({
      next:()=>{this.saving=false;this.toast.open('fantasy.saved','',{panelClass:'success-snackbar'});this.loadMine();this.loadBoard();},
      error:e=>{this.saving=false;const code=e?.error?.code;
        if(code==='FANTASY_TEAM_CHANGED'){this.stale=true;this.mineError='fantasy.changed';}
        else this.toast.open(({FANTASY_TRANSFER_LIMIT:'fantasy.transferLimit',FANTASY_BUDGET_EXCEEDED:'fantasy.budgetExceeded',FANTASY_SEASON_CLOSED:'fantasy.closed'} as Record<string,string>)[code]??'fantasy.saveFailed','',{panelClass:'error-snackbar'});
      }});
  }
  reloadMine():void {if(this.canLeave())this.loadMine();}
  loadBoard():void {
    if(!this.month)return;this.boardLoading=true;this.boardError=false;
    this.service.board(this.month).pipe(takeUntil(this.contextChanged),takeUntil(this.destroy)).subscribe({next:b=>{this.board=b;this.boardLoading=false;},error:()=>{this.boardError=true;this.boardLoading=false;}});
  }
  showTeam(id:string):void {
    this.publicTeam=null;this.publicLoading=true;
    this.service.publicTeam(this.month,id).pipe(takeUntil(this.contextChanged),takeUntil(this.destroy)).subscribe({next:t=>{this.publicTeam=t;this.publicLoading=false;},error:()=>{this.publicLoading=false;this.toast.open('fantasy.privateUnavailable','',{panelClass:'error-snackbar'});}});
  }
  canLeave():boolean {return !this.dirty||window.confirm(this.regional.text('fantasy.leave'));}
  ngOnDestroy():void{this.releaseUnload();this.destroy.next();this.destroy.complete();this.contextChanged.complete();this.searches.complete();}
}
