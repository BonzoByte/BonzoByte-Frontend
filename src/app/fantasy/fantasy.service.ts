import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
import { environment } from '@env/environment';
import { FantasyBoard,FantasyMarket,FantasyMine,FantasyPublicTeam,FantasyStatus,FantasyTeam } from './fantasy.models';
@Injectable({providedIn:'root'})
export class FantasyService {
  private readonly base=`${environment.apiUrl}/fantasy`;
  constructor(private http:HttpClient){}
  status(month?:string){return this.http.get<FantasyStatus>(`${this.base}/status`,{params:month?{month}:{}}).pipe(timeout(15000));}
  market(month:string,tour:string,q:string,page:number){return this.http.get<FantasyMarket>(`${this.base}/players`,{params:{month,...(tour?{tour}:{}),q,page}}).pipe(timeout(15000));}
  mine(month:string){return this.http.get<FantasyMine>(`${this.base}/me`,{params:{month}}).pipe(timeout(15000));}
  save(month:string,players:number[],revision:number,name:string){return this.http.put<{team:FantasyTeam}>(`${this.base}/team`,{players,revision,name},{params:{month}}).pipe(timeout(15000));}
  board(month:string){return this.http.get<FantasyBoard>(`${this.base}/leaderboard`,{params:{month}}).pipe(timeout(15000));}
  publicTeam(month:string,id:string){return this.http.get<FantasyPublicTeam>(`${this.base}/teams/${encodeURIComponent(id)}`,{params:{month}}).pipe(timeout(15000));}
}
