import {Component,Input} from '@angular/core';

/** The shared 42px spinner, with the spinner itself at the viewport centre. */
@Component({selector:'app-discussion-loading',standalone:true,
 template:`<div class="bb-loading-overlay is-active discussion-loading"><div class="bb-loading-card" role="status" aria-live="polite" aria-atomic="true">
   <span class="bb-spinner" aria-hidden="true"></span><span class="discussion-loading-label">{{label}}</span></div></div>`,
 styles:[`:host{display:contents;}
  .discussion-loading{pointer-events:none!important;}
  .bb-loading-card{position:relative;box-sizing:border-box;padding:0;width:42px;height:42px;gap:0;}
  .bb-spinner{flex:0 0 42px;border-color:var(--bb-border);border-top-color:var(--bb-accent,var(--bb-text));}
  .discussion-loading-label{position:absolute;top:calc(100% + 12px);left:50%;transform:translateX(-50%);width:min(320px,calc(100vw - 32px));
   text-align:center;overflow-wrap:anywhere;color:var(--bb-text);font-size:.9rem;}`]})
export class DiscussionLoadingComponent { @Input({required:true}) label!:string; }
