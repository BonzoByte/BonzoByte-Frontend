import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { Subscription } from 'rxjs';
import { RegionalSettingsService } from '../../core/services/regional-settings.service';

interface Metric {matches:number;correct:number;accuracy:number|null;coverage:number|null;meanConfidence:number|null;brier:number|null;logLoss:number|null;}
interface Cohort extends Metric {threshold:number;calibration:(Metric&{fromPercent:number;toPercent:number})[];periods:(Metric&{period:string})[];surfaces:(Metric&{surface:string})[];}
interface PerformanceReport {schema:string;generatedAtUtc:string;window:{fromInclusive:string;throughInclusive:string};sourceMatches:number;exclusions:Record<string,number>;marketOddsUsed:boolean;retrospective:boolean;prospectivelyValidated:boolean;predictionEligibility:{policyId:string;minimumPriorMatchesPerPlayer:number;excludesCurrentMatch:boolean};scopes:Record<string,{eligibleMatches:number;cohorts:Cohort[]}>;}

@Component({selector:'app-model-performance',standalone:true,imports:[CommonModule,FormsModule,TranslateModule,BaseChartDirective],
  templateUrl:'./model-performance.component.html',styleUrls:['./model-performance.component.scss']})
export class ModelPerformanceComponent implements OnInit,OnDestroy {
  report:PerformanceReport|null=null;
  loading=true;error=false;scope='ALL';threshold=60;granularity:'year'|'quarter'='year';
  curve:ChartData<'line'>={datasets:[]};calibration:ChartData<'scatter'>={datasets:[]};
  private request?:Subscription;private language?:Subscription;
  readonly curveOptions:ChartOptions<'line'>={responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:{x:{type:'linear',min:50,max:95,ticks:{color:'#8296a2',stepSize:5,callback:value=>'≥'+value+'%'},grid:{display:false}},y:{min:0,max:100,ticks:{color:'#8296a2',callback:value=>value+'%'},grid:{color:'rgba(130,150,162,.15)'}}},plugins:{legend:{labels:{color:'#8296a2',usePointStyle:true}}}};
  readonly calibrationOptions:ChartOptions<'scatter'>={responsive:true,maintainAspectRatio:false,scales:{x:{min:50,max:100,ticks:{color:'#8296a2',callback:value=>value+'%'},grid:{color:'rgba(130,150,162,.15)'}},y:{min:0,max:100,ticks:{color:'#8296a2',callback:value=>value+'%'},grid:{color:'rgba(130,150,162,.15)'}}},plugins:{legend:{labels:{color:'#8296a2',usePointStyle:true}}}};
  constructor(private http:HttpClient,public regional:RegionalSettingsService){}
  ngOnInit():void{document.body.classList.add('no-datebar');this.load();this.language=this.regional.changes.subscribe(()=>this.refresh());}
  ngOnDestroy():void{this.request?.unsubscribe();this.language?.unsubscribe();document.body.classList.remove('no-datebar');}
  load():void{
    this.request?.unsubscribe();this.loading=true;this.error=false;
    this.request=this.http.get<PerformanceReport>('/research/model-performance/report.json').subscribe({next:report=>{
      if(report.schema!=='bonzobyte.model-performance.v1'||report.marketOddsUsed!==false||report.retrospective!==true||report.prospectivelyValidated!==false||
         report.predictionEligibility?.policyId!=='both-players-min2-prior-valid-finished-v1'||report.predictionEligibility.minimumPriorMatchesPerPlayer!==2||!report.predictionEligibility.excludesCurrentMatch||
         !['ALL','ATP','WTA'].every(scope=>Array.isArray(report.scopes?.[scope]?.cohorts))){this.error=true;this.loading=false;return;}
      this.report=report;this.loading=false;this.refresh();
    },error:()=>{this.error=true;this.loading=false;}});
  }
  get cohort():Cohort|undefined{return this.report?.scopes[this.scope]?.cohorts.find(row=>row.threshold===Number(this.threshold));}
  get thresholds():number[]{return this.report?.scopes[this.scope]?.cohorts.map(row=>row.threshold)??[];}
  get periods():(Metric&{period:string})[]{return this.cohort?.periods.filter(row=>this.granularity==='quarter'?row.period.includes('Q'):!row.period.includes('Q'))??[];}
  get excluded():number{return Object.values(this.report?.exclusions??{}).reduce((a,b)=>a+b,0);}
  pct(value:number|null|undefined):string{return value==null?'—':this.regional.number(value*100,2)+'%';}
  count(value:number):string{return this.regional.number(value,0,true);}
  num(value:number|null|undefined):string{return value==null?'—':this.regional.number(value,4);}
  refresh():void{
    const cohorts=this.report?.scopes[this.scope]?.cohorts??[];
    const text=(key:string)=>this.regional.text('modelPerformance.'+key);
    this.curve={datasets:[
      {label:text('accuracy'),data:cohorts.filter(c=>c.accuracy!=null).map(c=>({x:c.threshold,y:c.accuracy!*100})),borderColor:'#20bfa9',backgroundColor:'rgba(32,191,169,.12)',pointRadius:2,tension:0.15},
      {label:text('coverage'),data:cohorts.filter(c=>c.coverage!=null).map(c=>({x:c.threshold,y:c.coverage!*100})),borderColor:'#69a8f5',pointRadius:2,borderDash:[5,4],tension:0.15}]};
    this.calibration={datasets:[{label:text('observed'),data:(this.cohort?.calibration??[]).filter(c=>c.meanConfidence!=null&&c.accuracy!=null).map(c=>({x:c.meanConfidence!*100,y:c.accuracy!*100})),borderColor:'#20bfa9',backgroundColor:'#20bfa9',showLine:true,pointRadius:4},
      {label:text('ideal'),data:[{x:50,y:50},{x:100,y:100}],borderColor:'#8296a2',showLine:true,borderDash:[5,4],pointRadius:0}]};
  }
}
