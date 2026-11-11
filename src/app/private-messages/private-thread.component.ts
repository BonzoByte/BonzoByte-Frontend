import{CommonModule}from'@angular/common';
import{CdkTextareaAutosize}from'@angular/cdk/text-field';
import{MessageAutosizeDirective}from'../shared/directives/message-autosize.directive';
import{DraftUnloadDirective}from'../shared/directives/draft-unload.directive';
import{MessageDayDividerComponent}from'../shared/ui/message-day-divider/message-day-divider.component';
import{InitialsAvatarComponent}from'../shared/ui/initials-avatar/initials-avatar.component';
import{UserPresenceComponent}from'../shared/ui/user-presence/user-presence.component';
import{Component,Input,OnChanges,OnDestroy,AfterViewInit,ViewChild,ViewChildren,QueryList,ElementRef,signal}from'@angular/core';
import{FormsModule}from'@angular/forms';
import{TranslateModule}from'@ngx-translate/core';
import{Subscription,EMPTY,expand,reduce}from'rxjs';
import{PrivateMessagesService,PrivateSelection,PrivateTarget,PrivateConversation,PrivatePage,PrivateMessage,PrivateProfile}from'../core/services/private-messages.service';
import{RegionalSettingsService}from'../core/services/regional-settings.service';
import{discussionLengthValid,discussionTextLength,discussionSelection}from'../core/helpers/discussion-text';
import{SubmitShortcutDirective}from'../shared/directives/submit-shortcut.directive';
@Component({selector:'app-private-thread',standalone:true,imports:[CommonModule,FormsModule,TranslateModule,SubmitShortcutDirective,CdkTextareaAutosize,MessageAutosizeDirective,DraftUnloadDirective,MessageDayDividerComponent,InitialsAvatarComponent,UserPresenceComponent],
 templateUrl:'./private-thread.component.html',styleUrls:['./private-thread.component.scss']})
export class PrivateThreadComponent implements OnChanges,AfterViewInit,OnDestroy{
 @Input({required:true}) selection!:PrivateSelection;
 @ViewChild('composer') composer?:ElementRef<HTMLTextAreaElement>;
 @ViewChildren('messageRow') rows!:QueryList<ElementRef<HTMLElement>>;
 readonly conversation=signal<PrivateConversation|null>(null);readonly target=signal<PrivateTarget|null>(null);readonly messages=signal<PrivateMessage[]>([]);
 readonly loading=signal(false);readonly busy=signal(false);readonly failed=signal(false);readonly actionFailed=signal(false);readonly hasMore=signal(false);readonly readFailed=signal(false);
 readonly confirm=signal<{kind:'block'|'delete'|'report'|'decline';message?:PrivateMessage}|null>(null);
 readonly rangeAfter=signal(0);private autoPosition=true;
 body='';reason='';emojiLimit=false;readonly emojis=['🙂','😄','😉','🤔','👍','👏','🎾'];
 private scope='';id='';private generation=0;private through=0;private readThrough=0;private seen=new Set<string>();
 private request?:Subscription;private mutation?:Subscription;private readRequest?:Subscription;private subscriptions=new Subscription();private rowChanges?:Subscription;
 private observer?:IntersectionObserver;private timer?:ReturnType<typeof setInterval>;private readTimer?:ReturnType<typeof setTimeout>;
 private failedAvatars=new Set<string>();private measured={body:'',count:0};
 readonly track=(_:number,message:PrivateMessage)=>message.id;
 get peer():PrivateProfile|null{const conversation=this.conversation();return conversation?conversation.peer:this.target()?.peer??null;}
 get canCompose():boolean{return this.api.eligible&&(this.id?this.conversation()?.canSend===true:this.target()?.canRequest===true);}
 get bodyCount():number{if(this.measured.body!==this.body)this.measured={body:this.body,count:discussionTextLength(this.body)};return this.measured.count;}
 get withinLimit():boolean{return this.body.length<=32000&&this.bodyCount<=1000;}
 get remaining():number{return Math.max(0,1000-this.bodyCount);}
 get reasonValid():boolean{return discussionLengthValid(this.reason,500);}
 get reasonRemaining():number{return Math.max(0,500-discussionTextLength(this.reason));}
 constructor(readonly api:PrivateMessagesService,readonly regional:RegionalSettingsService){
  this.subscriptions.add(api.accountChanged.subscribe(()=>{this.reset();this.api.selected.set(null);}));
  this.api.document.addEventListener('visibilitychange',this.visibility);
 }
 private readonly visibility=()=>{if(!this.api.visible){this.request?.unsubscribe();this.loading.set(false);clearTimeout(this.readTimer);}else if(this.id&&!this.busy())this.load(false);};
 ngOnChanges():void{this.reset();if(!this.api.eligible)return;this.id=this.selection.conversationId??'';this.scope=this.id?'c:'+this.id:'u:'+this.selection.userId;
  this.body=this.api.draft(this.scope).body;
  if(this.id)this.load(false);else if(this.selection.userId){this.loading.set(true);const generation=this.generation;
   this.request=this.api.call<PrivateTarget>('GET','/targets/'+this.selection.userId).subscribe({next:target=>{if(generation!==this.generation)return;this.target.set(target);this.loading.set(false);
    if(target.conversation){this.id=target.conversation.id;this.conversation.set(target.conversation);this.scope='c:'+this.id;this.body=this.api.draft(this.scope).body;this.load(false);}},error:()=>{this.loading.set(false);this.failed.set(true);}});}
  this.timer=setInterval(()=>{if(this.id&&this.api.visible&&!this.loading()&&!this.busy())this.load(false);},15000);
 }
 private reset():void{this.generation++;this.request?.unsubscribe();this.mutation?.unsubscribe();this.readRequest?.unsubscribe();clearInterval(this.timer);clearTimeout(this.readTimer);
  this.id='';this.scope='';this.through=this.readThrough=0;this.rangeAfter.set(0);this.autoPosition=true;this.seen.clear();this.messages.set([]);this.target.set(null);this.conversation.set(null);this.loading.set(false);this.busy.set(false);
  this.failed.set(false);this.actionFailed.set(false);this.readFailed.set(false);this.hasMore.set(false);this.confirm.set(null);this.body='';this.reason='';this.failedAvatars.clear();}
 load(more=false):void{if(!this.id||this.loading()||this.busy()||!this.api.visible)return;this.request?.unsubscribe();this.loading.set(true);this.failed.set(false);
  const generation=this.generation,through=this.through,after=more?through:this.rangeAfter();
  const first=this.api.call<PrivatePage>('GET','/conversations/'+this.id+'?after='+after+'&limit=20');
  const request=more?first:first.pipe(expand(page=>page.hasMore&&page.nextAfter<through?this.api.call<PrivatePage>('GET','/conversations/'+this.id+'?after='+page.nextAfter+'&limit=20'):EMPTY),
   reduce((all:PrivatePage|null,page)=>({...page,messages:[...(all?.messages??[]),...page.messages]}),null));
  this.request=request.subscribe({next:result=>{if(!result||generation!==this.generation)return;
   if(this.autoPosition&&!more&&after===0&&result.readThrough>20){this.autoPosition=false;this.readThrough=result.readThrough;
    this.rangeAfter.set(Math.max(0,result.readThrough-(result.latestSequence>result.readThrough?5:20)));this.loading.set(false);this.load(false);return;}
   this.autoPosition=false;this.conversation.set(result.conversation);
   this.messages.set(more?[...this.messages(),...result.messages]:result.messages);this.through=this.messages().at(-1)?.sequence??0;
   this.readThrough=Math.max(this.readThrough,result.readThrough);this.hasMore.set(result.hasMore);this.loading.set(false);},error:()=>{this.loading.set(false);this.failed.set(true);}});
 }
 showEarlier():void{if(this.loading()||this.busy())return;this.rangeAfter.set(0);this.autoPosition=false;this.through=0;this.load(false);}
 bodyChanged(value:string):void{this.body=value;this.emojiLimit=false;this.api.saveDraft(this.scope,value);}
 send():void{if(!this.canCompose||!this.body.trim()||!this.withinLimit||this.busy()||this.loading())return;
  const body=this.body,requestId=this.api.requestId(this.scope,body),scope=this.scope,generation=this.generation;
  const path=this.id?'/conversations/'+this.id+'/messages':'/requests';
  this.busy.set(true);this.actionFailed.set(false);this.mutation=this.api.call<{conversation:PrivateConversation;message:PrivateMessage}>('POST',path,
   {body,clientRequestId:requestId,...(!this.id?{recipientId:this.selection.userId}:{})}).subscribe({next:result=>{if(generation!==this.generation)return;
    this.api.confirmed(scope,body,requestId);if(this.body===body)this.body='';this.id=result.conversation.id;this.scope='c:'+this.id;
    this.conversation.set(result.conversation);this.busy.set(false);this.api.notify();this.load(false);},error:()=>{this.busy.set(false);this.actionFailed.set(true);}});
 }
 decide(accept:boolean):void{if(!this.conversation()?.canAccept||this.busy())return;this.act('PUT','/conversations/'+this.id+'/decision',{accept});}
 ask(kind:'block'|'delete'|'report'|'decline',message?:PrivateMessage):void{this.reason='';this.confirm.set({kind,message});}
 perform():void{const confirm=this.confirm();if(!confirm||this.busy())return;
  if(confirm.kind==='report'&&!this.reasonValid)return;
  if(confirm.kind==='decline')this.decide(false);
  if(confirm.kind==='block'&&this.peer)this.act('PUT','/users/'+this.peer.id+'/block',{blocked:true});
  if(confirm.kind==='delete'&&confirm.message)this.act('DELETE','/messages/'+confirm.message.id,undefined,confirm.message.id);
  if(confirm.kind==='report'&&confirm.message)this.act('POST','/messages/'+confirm.message.id+'/report',{reason:this.reason});
 }
 unblock():void{if(this.conversation()?.blockedByMe&&this.peer)this.act('PUT','/users/'+this.peer.id+'/block',{blocked:false});}
 private act(method:string,path:string,body?:unknown,deletedId?:string):void{this.busy.set(true);this.actionFailed.set(false);
  this.mutation=this.api.call(method,path,body).subscribe({next:()=>{this.busy.set(false);this.confirm.set(null);this.reason='';
   if(deletedId)this.messages.update(messages=>messages.map(message=>message.id===deletedId?{...message,body:'',deleted:true,author:null}:message));
   this.api.notify();this.load(false);},error:()=>{this.busy.set(false);this.actionFailed.set(true);}});}
 insertEmoji(emoji:string):void{const input=this.composer?.nativeElement;if(!input||this.busy()||!this.emojis.includes(emoji))return;
  const[start,end]=discussionSelection(this.body,input.selectionStart,input.selectionEnd),next=this.body.slice(0,start)+emoji+this.body.slice(end);
  if(!discussionLengthValid(next)){this.emojiLimit=true;return;}this.bodyChanged(next);input.value=next;input.focus();input.setSelectionRange(start+emoji.length,start+emoji.length);}
 avatar(profile:PrivateProfile|null):string|null{const value=profile?.avatarUrl;if(!value||this.failedAvatars.has(value)||/[<>@\s\\]/u.test(value))return null;
  if(/^\/uploads\/[A-Za-z0-9/_.,-]+$/.test(value))return value;try{const url=new URL(value);return['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}}
 avatarFailed(profile:PrivateProfile|null):void{if(profile?.avatarUrl)this.failedAvatars.add(profile.avatarUrl);}
 ngAfterViewInit():void{this.observer=new IntersectionObserver(entries=>{for(const entry of entries){const row=entry.target as HTMLElement;
   if(this.api.visible&&row.isConnected&&entry.isIntersecting&&entry.intersectionRatio>0&&entry.intersectionRect.width>0
    &&entry.intersectionRect.height>=Math.min(160,Math.max(1,entry.boundingClientRect.height/2))&&row.dataset['pmId'])this.seen.add(row.dataset['pmId']!);}
   clearTimeout(this.readTimer);this.readTimer=setTimeout(()=>this.markRead(),500);
  },{threshold:[0,.1,.25,.5,1]});this.rowChanges=this.rows.changes.subscribe(()=>this.observe());this.observe();}
 private observe():void{this.observer?.disconnect();this.rows?.forEach(row=>this.observer?.observe(row.nativeElement));}
 markRead():void{if(!this.id||!this.api.visible||this.readRequest&&!this.readRequest.closed)return;let through=this.readThrough;
  for(const message of this.messages()){if(message.sequence<=through)continue;if(message.sequence>through+1)break;
   if(!message.mine&&!message.deleted&&!this.seen.has(message.id))break;through=message.sequence;}
  if(through<=this.readThrough)return;this.readFailed.set(false);
  this.readRequest=this.api.call<{readThrough:number}>('PUT','/conversations/'+this.id+'/read',{through}).subscribe({next:result=>{this.readThrough=result.readThrough;this.api.notify();},error:()=>this.readFailed.set(true)});}
 ngOnDestroy():void{this.reset();this.observer?.disconnect();this.rowChanges?.unsubscribe();this.subscriptions.unsubscribe();this.api.document.removeEventListener('visibilitychange',this.visibility);}
}
