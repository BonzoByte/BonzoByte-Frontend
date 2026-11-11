import {HttpClient} from '@angular/common/http';
import {Inject,Injectable,Injector,OnDestroy,Optional,signal} from '@angular/core';
import {Subject,Subscription,Observable,throwError,defer} from 'rxjs';
import {takeUntil,timeout} from 'rxjs/operators';
import {environment} from '@env/environment';
import {AuthService} from './auth.service';
import {DiscussionsService} from './discussions.service';
import {DraftUnloadGuardService} from './draft-unload-guard.service';
export interface PrivateProfile{id:string;nickname:string;avatarUrl:string|null;}
export interface PrivateConversation{id:string;peer:PrivateProfile|null;status:'pending'|'accepted'|'declined'|'closed';requestedByMe:boolean;
 canSend:boolean;canAccept:boolean;blocked:boolean;blockedByMe:boolean;unread:boolean;lastActivityAt:string;lastPreview?:string|null;}
export interface PrivateMessage{id:string;sequence:number;body:string;createdAt:string;author:PrivateProfile|null;mine:boolean;deleted:boolean;canReport:boolean;}
export interface PrivatePage{conversation:PrivateConversation;messages:PrivateMessage[];readThrough:number;total:number;latestSequence:number;hasMore:boolean;nextAfter:number;}
export interface PrivateTarget{peer:PrivateProfile;conversation:PrivateConversation|null;canRequest:boolean;}
export interface PrivateInbox{conversations:PrivateConversation[];hasMore:boolean;nextAfter:string|null;}
export interface PrivateDraft{body:string;requestId?:string;}
export interface PrivateReport{id:string;createdAt:string;resolved:boolean;}
export interface PrivateReview{report:PrivateReport&{reason:string;messageId:string};messages:PrivateMessage[];}
export interface PrivateSelection{userId?:string;conversationId?:string;}
@Injectable({providedIn:'root'})
export class PrivateMessagesService implements OnDestroy{
 readonly selected=signal<PrivateSelection|null>(null);
 readonly unreadCount=signal(0);readonly summaryError=signal(false);readonly changed=new Subject<void>();
 readonly accountChanged=new Subject<void>();private readonly subscriptions=new Subscription();private summaryRequest?:Subscription;
 private started=false;private identity='';private readonly drafts=new Map<string,PrivateDraft>();
 private readonly failedAvatars=new Set<string>();
 private readonly base=environment.apiUrl+'/private-messages';
 private readonly releaseUnload?:()=>void;
 constructor(private injector:Injector,private auth:AuthService,readonly discussions:DiscussionsService,
  @Optional() @Inject(DraftUnloadGuardService) private unload:DraftUnloadGuardService|null=null){
  this.releaseUnload=unload?.register(()=>this.drafts.size>0);
  this.subscriptions.add(auth.user$.subscribe(user=>{const identity=(user?._id??'')+':'+!!user?.isVerified;
   if(identity===this.identity)return;this.identity=identity;this.summaryRequest?.unsubscribe();this.selected.set(null);this.unreadCount.set(0);this.summaryError.set(false);this.drafts.clear();this.failedAvatars.clear();this.unload?.refresh();this.accountChanged.next();
   if(this.started)this.refreshSummary();}));
  this.subscriptions.add(discussions.pulse.subscribe(()=>{if(this.started)this.refreshSummary();}));
 }
 get eligible():boolean{return!environment.billingLab&&!!this.auth.getUser()?._id&&this.auth.getUser()?.isVerified===true;}
 get isAdmin():boolean{return this.eligible&&this.auth.getUser()?.isAdmin===true;}
 get visible():boolean{return this.discussions.visible;}
 get document():Document{return this.discussions.document;}
 start():void{if(this.started)return;this.started=true;this.refreshSummary();}
 stop():void{this.started=false;this.summaryRequest?.unsubscribe();}
 refreshSummary(allowBackground=false):void{if(!this.eligible||(!allowBackground&&!this.visible))return;this.summaryRequest?.unsubscribe();
  this.summaryRequest=this.call<{unreadCount:number}>('GET','/summary').subscribe({next:result=>{
   if(!Number.isSafeInteger(result?.unreadCount)||result.unreadCount<0){this.summaryError.set(true);return;}
   this.unreadCount.set(result.unreadCount);this.summaryError.set(false);},error:()=>this.summaryError.set(true)});}
 call<T>(method:string,path:string,body?:unknown):Observable<T>{if(!this.eligible)return throwError(()=>new Error('PM_AUTH_REQUIRED'));
  return defer(()=>this.injector.get(HttpClient).request<T>(method,this.base+path,{body})).pipe(timeout(45000),takeUntil(this.accountChanged));}
 canContact(profile:{id:string}|null|undefined):boolean{return this.eligible&&!!profile&&/^[a-f0-9]{24}$/.test(profile.id)&&profile.id!==this.auth.getUser()?._id;}
 avatar(profile:PrivateProfile|null):string|null{const value=profile?.avatarUrl;if(!value||this.failedAvatars.has(value)||/[<>@\s\\]/u.test(value))return null;
  if(/^\/uploads\/[A-Za-z0-9/_.,-]+$/.test(value))return value;try{const url=new URL(value);return['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}}
 avatarFailed(profile:PrivateProfile|null):void{if(profile?.avatarUrl)this.failedAvatars.add(profile.avatarUrl);}
 openUser(profile:PrivateProfile):void{if(!this.canContact(profile))return;this.discussions.selected.set(null);this.selected.set({userId:profile.id});}
 openConversation(conversationId:string):void{if(!this.eligible||!/^[a-f0-9]{24}$/.test(conversationId))return;this.discussions.selected.set(null);this.selected.set({conversationId});}
 notify():void{this.refreshSummary();this.changed.next();}
 draft(scope:string):PrivateDraft{return{...(this.drafts.get(scope)??{body:''})};}
 saveDraft(scope:string,body:string):void{const previous=this.drafts.get(scope);if(!body.trim()){this.drafts.delete(scope);this.unload?.refresh();return;}
  if(body.length>32000)return;this.drafts.set(scope,{body,...(previous?.body===body&&previous.requestId?{requestId:previous.requestId}:{})});this.unload?.refresh();}
 requestId(scope:string,body:string):string{this.saveDraft(scope,body);const draft=this.drafts.get(scope)!;return draft.requestId??=crypto.randomUUID();}
 confirmed(scope:string,body:string,requestId:string):void{const draft=this.drafts.get(scope);if(draft?.body===body&&draft.requestId===requestId)this.drafts.delete(scope);this.unload?.refresh();}
 ngOnDestroy():void{this.stop();this.subscriptions.unsubscribe();this.selected.set(null);this.drafts.clear();this.releaseUnload?.();this.accountChanged.next();this.accountChanged.complete();this.changed.complete();}
}
