import{CommonModule}from'@angular/common';
import{Component,EventEmitter,OnDestroy,OnInit,Output,signal}from'@angular/core';
import{FormsModule}from'@angular/forms';
import{TranslateModule}from'@ngx-translate/core';
import{Subscription}from'rxjs';
import{PrivateMessagesService,PrivateConversation,PrivateInbox,PrivateProfile,PrivateReport,PrivateReview}from'../core/services/private-messages.service';
import{RegionalSettingsService}from'../core/services/regional-settings.service';
import{InitialsAvatarComponent}from'../shared/ui/initials-avatar/initials-avatar.component';
import{UserPresenceComponent}from'../shared/ui/user-presence/user-presence.component';
@Component({selector:'app-private-inbox',standalone:true,imports:[CommonModule,FormsModule,TranslateModule,InitialsAvatarComponent,UserPresenceComponent],
 styleUrls:['./private-inbox.component.scss'],
 template:`<ng-container *ngIf="api.eligible; else verify">
 <p class="note">{{'privateMessages.inboxNote'|translate}}</p>
 <label class="pm-setting"><input type="checkbox" [checked]="requestsEnabled()" [disabled]="settingsBusy()||!settingsLoaded()" (change)="setRequests($any($event.target).checked)">{{'privateMessages.allowRequests'|translate}}</label>
 <div class="actions"><button type="button" [disabled]="loading()" (click)="refresh()">{{'discussions.refresh'|translate}}</button>
 <button type="button" (click)="loadBlocked()">{{'privateMessages.blockedUsers'|translate}}</button>
 <button *ngIf="api.isAdmin" type="button" (click)="loadReports()">{{'privateMessages.reports'|translate}}</button></div>
 <p *ngIf="failed()||settingsFailed()" role="alert">{{'privateMessages.failed'|translate}}</p><p *ngIf="loading()" role="status">{{'common.loading'|translate}}</p>
 <p *ngIf="page()&&!loading()&&!page()!.conversations.length">{{'privateMessages.empty'|translate}}</p>
 <ul class="pm-inbox"><li *ngFor="let row of page()?.conversations;trackBy:track">
 <button class="pm-conversation" type="button" (click)="open(row)"><span class="peer"><span class="pm-avatar-slot"><span class="pm-avatar" aria-hidden="true"><img *ngIf="api.avatar(row.peer) as url;else noAvatar" [src]="url" alt="" referrerpolicy="no-referrer" (error)="api.avatarFailed(row.peer)"><ng-template #noAvatar><app-initials-avatar [identity]="row.peer?.id" [nickname]="row.peer?.nickname"></app-initials-avatar></ng-template></span><app-user-presence [userId]="row.peer?.id" [conversationId]="row.id" [enabled]="row.status === 'accepted' && !row.blocked"></app-user-presence></span><span>{{row.peer?.nickname||('privateMessages.formerMember'|translate)}}</span>
 <i *ngIf="row.unread" class="bi bi-chat-left-dots-fill" [title]="'privateMessages.unread'|translate" [attr.aria-label]="'privateMessages.unread'|translate"></i></span>
 <time>{{regional.dateTime(row.lastActivityAt,'utc')}}</time><span class="preview">{{row.lastPreview||('privateMessages.noPreview'|translate)}}</span>
 <span class="note">{{('privateMessages.status.'+row.status)|translate}}</span></button></li></ul>
 <nav class="actions" *ngIf="index()>0||page()?.hasMore"><button type="button" [disabled]="loading()||index()===0" (click)="previous()">{{'discussions.minePrevious'|translate}}</button>
 <span>{{regional.number(index()+1,0,true)}}</span><button type="button" [disabled]="loading()||!page()?.hasMore" (click)="next()">{{'discussions.mineNext'|translate}}</button></nav>
 <section *ngIf="blocked() as list"><h4>{{'privateMessages.blockedUsers'|translate}}</h4><p *ngIf="!list.length">{{'privateMessages.noneBlocked'|translate}}</p>
 <div class="actions" *ngFor="let user of list"><span>{{user.profile?.nickname||('privateMessages.formerMember'|translate)}}</span><button type="button" [disabled]="loading()" (click)="unblock(user.id)">{{'privateMessages.unblock'|translate}}</button></div>
 <button *ngIf="blockedAfter" type="button" (click)="loadBlocked(true)">{{'discussions.moreThreads'|translate}}</button></section>
 <section *ngIf="reports() as list"><h4>{{'privateMessages.reports'|translate}}</h4><p class="note">{{'privateMessages.reportScope'|translate}}</p>
 <button class="report" type="button" *ngFor="let report of list" (click)="review(report.id)">{{regional.dateTime(report.createdAt,'utc')}} · {{(report.resolved?'privateMessages.resolved':'privateMessages.openReport')|translate}}</button>
 <button *ngIf="reportsAfter" type="button" (click)="loadReports(true)">{{'discussions.moreThreads'|translate}}</button>
 <div *ngIf="reviewed() as result" class="review"><p>{{result.report.reason}}</p><article *ngFor="let message of result.messages" [class.reported]="message.id===result.report.messageId">
 <strong>{{message.author?.nickname||('privateMessages.formerMember'|translate)}}</strong><p>{{message.deleted?('privateMessages.deleted'|translate):message.body}}</p></article>
 <button *ngIf="!result.report.resolved" type="button" (click)="resolve(result.report.id)">{{'privateMessages.resolve'|translate}}</button></div></section>
 </ng-container><ng-template #verify><p>{{'discussions.verify'|translate}}</p></ng-template>`,
 styles:[`:host{display:block;min-width:0;max-width:100%;}.note,time{font-size:.8rem;color:var(--bb-text-muted);white-space:normal;overflow-wrap:anywhere;}.pm-setting,.actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:8px 0;}.pm-setting input{width:auto;margin:0;}button{background:var(--bb-surface-2);color:var(--bb-text);border:1px solid var(--bb-border);border-radius:6px;padding:8px;cursor:pointer;max-width:100%;white-space:normal;overflow-wrap:anywhere;}button:disabled{opacity:.5;cursor:default;}button:focus-visible{outline:2px solid var(--bb-theme-accent);outline-offset:2px;}.pm-inbox{list-style:none;margin:12px 0;padding:0;display:grid;gap:8px;}.pm-conversation{display:grid;width:100%;grid-template-columns:minmax(0,1fr) auto;gap:5px;text-align:left;}.peer{font-weight:600;min-width:0;overflow-wrap:anywhere;}.peer i{color:var(--bb-theme-accent);margin-left:6px;}.preview{grid-column:1/-1;white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:.85rem;}.report{display:block;width:100%;text-align:left;margin:6px 0;}.review{max-width:100%;}.review article{border:1px solid var(--bb-border);padding:8px;margin:8px 0;}.review p{white-space:pre-wrap;overflow-wrap:anywhere;}.review .reported{border-color:var(--bb-theme-accent);}@media(max-width:400px){.pm-conversation{grid-template-columns:minmax(0,1fr);}time{grid-column:1;}}`]})
export class PrivateInboxComponent implements OnInit,OnDestroy{
 @Output() conversationOpened=new EventEmitter<void>();readonly page=signal<PrivateInbox|null>(null);readonly loading=signal(false);readonly failed=signal(false);readonly index=signal(0);
 readonly requestsEnabled=signal(true);readonly settingsLoaded=signal(false);readonly settingsBusy=signal(false);
 readonly settingsFailed=signal(false);
 readonly blocked=signal<{id:string;profile:PrivateProfile|null}[]|null>(null);readonly reports=signal<PrivateReport[]|null>(null);readonly reviewed=signal<PrivateReview|null>(null);
 blockedAfter:string|null=null;reportsAfter:string|null=null;private cursors:(string|undefined)[]=[undefined];private pending?:Subscription;private subscriptions=new Subscription();
 readonly track=(_:number,row:PrivateConversation)=>row.id;
 constructor(readonly api:PrivateMessagesService,readonly regional:RegionalSettingsService){}
 ngOnInit():void{if(!this.api.eligible)return;this.loadSettings();
  this.subscriptions.add(this.api.accountChanged.subscribe(()=>{this.pending?.unsubscribe();this.page.set(null);this.blocked.set(null);this.reports.set(null);this.reviewed.set(null);}));
  this.subscriptions.add(this.api.changed.subscribe(()=>this.refresh()));this.subscriptions.add(this.api.discussions.pulse.subscribe(()=>{if(this.api.visible&&!this.loading()){this.load(this.index());if(this.reviewed())this.review(this.reviewed()!.report.id);}}));this.refresh();this.api.refreshSummary();}
 private loadSettings():void{if(this.settingsBusy())return;this.settingsBusy.set(true);this.settingsFailed.set(false);
  this.subscriptions.add(this.api.call<{requestsEnabled:boolean}>('GET','/settings').subscribe({next:v=>{this.requestsEnabled.set(v.requestsEnabled);this.settingsLoaded.set(true);this.settingsBusy.set(false);},error:()=>{this.settingsBusy.set(false);this.settingsFailed.set(true);}}));}
 refresh():void{if(!this.settingsLoaded()&&!this.settingsBusy())this.loadSettings();this.cursors=[undefined];this.load(0);}
 private load(index:number):void{if(!this.api.eligible)return;this.pending?.unsubscribe();this.loading.set(true);this.failed.set(false);const after=this.cursors[index];
  this.pending=this.api.call<PrivateInbox>('GET','/inbox?limit=20'+(after?'&after='+encodeURIComponent(after):'')).subscribe({next:page=>{this.page.set(page);this.index.set(index);this.loading.set(false);},error:()=>{this.loading.set(false);this.failed.set(true);}});}
 next():void{if(this.loading()||!this.page()?.nextAfter)return;this.cursors[this.index()+1]=this.page()!.nextAfter!;this.load(this.index()+1);}
 previous():void{if(!this.loading()&&this.index()>0)this.load(this.index()-1);}
 open(row:PrivateConversation):void{this.api.openConversation(row.id);this.conversationOpened.emit();}
 setRequests(enabled:boolean):void{const previous=this.requestsEnabled();this.requestsEnabled.set(enabled);this.settingsBusy.set(true);this.settingsFailed.set(false);this.subscriptions.add(this.api.call<{requestsEnabled:boolean}>('PUT','/settings',{requestsEnabled:enabled}).subscribe({next:v=>{this.requestsEnabled.set(v.requestsEnabled);this.settingsBusy.set(false);},error:()=>{this.requestsEnabled.set(previous);this.settingsBusy.set(false);this.settingsFailed.set(true);}}));}
 loadBlocked(more=false):void{const after=more?this.blockedAfter:null;this.subscriptions.add(this.api.call<{users:{id:string;profile:PrivateProfile|null}[];hasMore:boolean;nextAfter:string|null}>('GET','/blocked'+(after?'?after='+after:'')).subscribe({next:v=>{this.blocked.set([...(more?this.blocked()??[]:[]),...v.users]);this.blockedAfter=v.nextAfter;},error:()=>this.failed.set(true)}));}
 unblock(id:string):void{this.subscriptions.add(this.api.call('PUT','/users/'+id+'/block',{blocked:false}).subscribe({next:()=>{this.loadBlocked();this.api.notify();},error:()=>this.failed.set(true)}));}
 loadReports(more=false):void{if(!this.api.isAdmin)return;this.subscriptions.add(this.api.call<{reports:PrivateReport[];hasMore:boolean;nextAfter:string|null}>('GET','/reports'+(more&&this.reportsAfter?'?after='+this.reportsAfter:'')).subscribe({next:v=>{this.reports.set([...(more?this.reports()??[]:[]),...v.reports]);this.reportsAfter=v.nextAfter;},error:()=>this.failed.set(true)}));}
 review(id:string):void{this.subscriptions.add(this.api.call<PrivateReview>('GET','/reports/'+id).subscribe({next:v=>this.reviewed.set(v),error:()=>{this.reviewed.set(null);this.failed.set(true);}}));}
 resolve(id:string):void{this.subscriptions.add(this.api.call('POST','/reports/'+id+'/resolve',{}).subscribe({next:()=>{this.reviewed.set(null);this.loadReports();},error:()=>this.failed.set(true)}));}
 ngOnDestroy():void{this.pending?.unsubscribe();this.subscriptions.unsubscribe();}
}
