import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, inject, Injector, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({ selector: 'app-view-recovery-actions', standalone: true,
  imports: [CommonModule, TranslateModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="view-actions" *ngIf="showClear || showBrowse || showRetry">
    <button *ngIf="showClear" type="button" class="clear-view" [disabled]="loading" (click)="clearFilters.emit()">{{ 'viewRecovery.clear' | translate }}</button>
    <button *ngIf="showRetry" type="button" class="retry-view" [disabled]="loading" (click)="retry.emit()">{{ 'viewRecovery.retry' | translate }}</button>
    <a *ngIf="showBrowse" href="/matches" class="browse-matches" (click)="navigate($event)">{{ 'viewRecovery.browse' | translate }}</a>
  </div>`,
  styles: [`:host{display:block;} .view-actions{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:8px;margin-top:10px;}
    button,a{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:34px;padding:7px 12px;
      border:1px solid var(--bb-border-strong,#526071);border-radius:8px;background:var(--bb-surface-2,#202a33);color:var(--bb-text,#e8edf2);
      font:inherit;font-size:12px;line-height:1.4;text-decoration:none;cursor:pointer;white-space:normal;}
    button:hover,a:hover{border-color:var(--bb-accent,#80d5ff);} button:focus-visible,a:focus-visible{outline:2px solid var(--bb-accent,#80d5ff);outline-offset:2px;}
    button:disabled{opacity:.5;cursor:default;}`] })
export class ViewRecoveryActionsComponent {
  @Input() showClear = false;
  @Input() showBrowse = false;
  @Input() showRetry = false;
  @Input() loading = false;
  @Output() clearFilters = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();
  @Output() browse = new EventEmitter<void>();
  private readonly injector = inject(Injector);
  navigate(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const router = this.injector.get(Router, null);
    if (router) { event.preventDefault(); void router.navigateByUrl('/matches'); }
    this.browse.emit();
  }
}
