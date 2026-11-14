import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, timeout } from 'rxjs';
import { environment } from '@env/environment';
import type { ArcadeBoard } from '../arcade/tennis-career.service';
import { RegionalSettingsService } from '../core/services/regional-settings.service';

@Component({selector:'app-arcade-leaderboard',standalone:true,imports:[CommonModule,FormsModule,TranslateModule],
  templateUrl:'./arcade-leaderboard.component.html',styleUrls:['./arcade-leaderboard.component.scss']})
export class ArcadeLeaderboardComponent implements OnInit,OnDestroy {
  @Input() initialMonth='';
  readonly maxMonth=new Date().toISOString().slice(0,7);
  month=this.maxMonth;
  board:ArcadeBoard|null=null;
  loading=false;failed=false;
  private request?:Subscription;
  constructor(private http:HttpClient,readonly regional:RegionalSettingsService){}
  ngOnInit():void {if(/^20\d{2}-(0[1-9]|1[0-2])$/.test(this.initialMonth)&&this.initialMonth<=this.maxMonth&&this.initialMonth>='2020-01')this.month=this.initialMonth;this.load();}
  load():void {
    this.request?.unsubscribe();this.board=null;this.failed=false;
    if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(this.month)||this.month>this.maxMonth||this.month<'2020-01'){this.loading=false;return;}
    this.loading=true;
    this.request=this.http.get<ArcadeBoard>(`${environment.apiUrl}/arcade/leaderboard`,{params:{month:this.month}}).pipe(timeout(15000)).subscribe({
      next:board=>{this.board=board;this.loading=false;},error:()=>{this.failed=true;this.loading=false;}
    });
  }
  ngOnDestroy():void {this.request?.unsubscribe();}
}
