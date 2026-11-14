import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { CompetitionPageComponent } from './competition-page.component';
import { FantasyPageComponent } from '../fantasy/fantasy-page.component';
import { ArcadeLeaderboardComponent } from './arcade-leaderboard.component';

export type LeaderboardTab = 'picks' | 'tennis-break' | 'fantasy';
@Component({selector:'app-leaderboard-page',standalone:true,
  imports:[CommonModule,RouterModule,TranslateModule,CompetitionPageComponent,FantasyPageComponent,ArcadeLeaderboardComponent],
  templateUrl:'./leaderboard-page.component.html',styleUrls:['./leaderboard-page.component.scss']})
export class LeaderboardPageComponent implements OnInit,OnDestroy {
  readonly tabs = [{id:'picks',label:'competition.picks'},{id:'tennis-break',label:'tennisBreak.title'},
    {id:'fantasy',label:'fantasy.title'}] as const;
  tab:LeaderboardTab='picks';
  month='';
  private routeSubscription?:Subscription;
  constructor(private route:ActivatedRoute,private router:Router,private host:ElementRef<HTMLElement>){}
  ngOnInit():void {
    this.routeSubscription=this.route.queryParamMap.subscribe(params=>{
      const tab=params.get('tab');this.tab=tab==='tennis-break'||tab==='fantasy'?tab:'picks';this.month=params.get('month')||'';
    });
  }
  queryFor(tab:LeaderboardTab):Record<string,string|null> {
    // Pick-only demo flags and time windows must never leak into another competition.
    const query:Record<string,string|null>={tab:tab==='picks'?null:tab};
    if(tab===this.tab){query['month']=this.route.snapshot.queryParamMap.get('month');if(tab==='picks')query['demo']=this.route.snapshot.queryParamMap.get('demo');}
    return query;
  }
  tabKey(event:KeyboardEvent):void {
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const current=this.tabs.findIndex(item=>item.id===this.tab);
    const index=event.key==='Home'?0:event.key==='End'?2:(current+(event.key==='ArrowRight'?1:2))%3;
    const tab=this.tabs[index].id;
    void this.router.navigate(['/competition'],{queryParams:this.queryFor(tab)}).then(()=>{
      this.host.nativeElement.querySelector<HTMLElement>('#ranking-tab-'+tab)?.focus();
    });
  }
  ngOnDestroy():void {this.routeSubscription?.unsubscribe();}
}
