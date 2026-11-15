import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { TennisCareerService } from './tennis-career.service';
import { environment } from '@env/environment';

describe('Arcade career API boundary',()=>{
  let service:TennisCareerService,http:HttpTestingController,user$:BehaviorSubject<any>;
  const root=environment.apiUrl+'/arcade';
  beforeEach(()=>{
    user$=new BehaviorSubject(null);
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),{provide:AuthService,useValue:{user$}}]});
    service=TestBed.inject(TennisCareerService);http=TestBed.inject(HttpTestingController);
  });
  afterEach(()=>{service.ngOnDestroy();http.verify();});
  it('searches the API rather than creating fictional players and cancels stale searches',()=>{
    service.search('first');const old=http.expectOne(root+'/opponents?q=first');service.search('second');expect(old.cancelled).toBeTrue();
    http.expectOne(root+'/opponents?q=second').flush({items:[{id:1,name:'Real',ts:25}],engineVersion:'kernel'});
    expect(service.opponents()[0].name).toBe('Real');expect(service.engineVersion()).toBe('kernel');
  });
  it('clears stale suggestions and errors during a new query and retains the chosen opponent',()=>{
    service.selected.set({id:1,name:'Selected',ts:25,countryISO2:null,countryISO3:null,lastMatch:null});
    service.opponents.set([service.selected()!]);service.catalogError.set(true);service.search('new');
    expect(service.opponents()).toEqual([]);expect(service.catalogError()).toBeFalse();expect(service.searching()).toBeTrue();
    http.expectOne(root+'/opponents?q=new').flush({items:[],engineVersion:'kernel'});
    expect(service.selected()?.name).toBe('Selected');expect(service.searching()).toBeFalse();
  });
  it('clears private history and cancels in-flight writes when accounts change',()=>{
    user$.next({_id:'one',isVerified:true});http.expectOne(root+'/me').flush({career:{mu:25}});
    expect(service.verified()).toBeTrue();
    service.start({opponentId:1,surface:'grass',requestId:'id',engineVersion:'version',publicRanking:true}).subscribe();
    const write=http.expectOne(root+'/sessions');user$.next(null);
    expect(write.cancelled).toBeTrue();expect(service.profile()).toBeNull();expect(service.signedIn()).toBeFalse();
  });
  it('does not retry a failed write automatically or accept a client-provided winner',()=>{
    let failed=false;service.finish('synthetic','replay').subscribe({error:()=>failed=true});
    const request=http.expectOne(root+'/sessions/synthetic/finish');expect(request.request.body).toEqual({replay:'replay'});
    request.flush({code:'ARCADE_UNAVAILABLE'},{status:503,statusText:'Unavailable'});expect(failed).toBeTrue();http.expectNone(root+'/sessions/synthetic/finish');
  });
  it('does not silently show an empty standings list when its request fails',()=>{
    service.refreshBoard();service.refreshBoard();http.expectOne(root+'/leaderboard').flush({}, {status:503,statusText:'Unavailable'});
    expect(service.boardError()).toBeTrue();expect(service.boardLoading()).toBeFalse();
  });
});
