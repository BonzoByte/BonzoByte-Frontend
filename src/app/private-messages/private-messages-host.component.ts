import{CommonModule}from'@angular/common';
import{Component,OnInit,OnDestroy,ViewEncapsulation}from'@angular/core';
import{A11yModule}from'@angular/cdk/a11y';
import{TranslateModule}from'@ngx-translate/core';
import{PrivateMessagesService}from'../core/services/private-messages.service';
import{BbModalShellComponent}from'../shared/ui/bb-modal-shell.component/bb-modal-shell.component';
import{PrivateThreadComponent}from'./private-thread.component';
@Component({selector:'app-private-messages-host',standalone:true,imports:[CommonModule,A11yModule,TranslateModule,BbModalShellComponent,PrivateThreadComponent],encapsulation:ViewEncapsulation.None,
 styles:[`app-private-messages-host .bb-modal--private-messages{width:min(680px,calc(100vw - 24px));max-height:90dvh;overflow:auto;}`],
 template:`<app-bb-modal-shell *ngIf="api.selected() as target" cdkTrapFocus [cdkTrapFocusAutoCapture]="true" [title]="'privateMessages.title'|translate"
 [closeLabel]="'common.close'|translate" modalClass="bb-modal--private-messages" (closed)="api.selected.set(null)"><app-private-thread [selection]="target"></app-private-thread></app-bb-modal-shell>`})
export class PrivateMessagesHostComponent implements OnInit,OnDestroy{constructor(readonly api:PrivateMessagesService){}ngOnInit():void{this.api.start();}ngOnDestroy():void{this.api.selected.set(null);this.api.stop();}}
