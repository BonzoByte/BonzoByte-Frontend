import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { AppUpdateService } from '../../../core/services/app-update.service';

@Component({ selector: 'app-update-notice', standalone: true, imports: [CommonModule, TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<aside *ngIf="updates.availableRelease()" class="app-update-notice" role="status" aria-live="polite">
        <div><strong>{{ 'appUpdate.available' | translate }}</strong><span>{{ 'appUpdate.hint' | translate }}</span></div>
        <div class="app-update-actions">
          <button type="button" class="oauth-btn" [disabled]="updates.offline()" (click)="updates.refreshApp()">{{ 'appUpdate.refresh' | translate }}</button>
          <button type="button" class="oauth-btn" (click)="updates.later()">{{ 'appUpdate.later' | translate }}</button>
        </div>
      </aside>`,
    styles: [`:host{display:contents}
      .app-update-notice{position:fixed;left:12px;bottom:calc(var(--footer-h,36px) + 12px);z-index:1000;
        width:min(460px,calc(100vw - 24px));box-sizing:border-box;display:flex;flex-wrap:wrap;align-items:center;
        gap:10px 16px;padding:12px;border:1px solid var(--bb-border-strong,#657481);border-radius:8px;
        background:var(--bb-surface-2,#202a33);color:var(--bb-text,#e8edf2);box-shadow:0 3px 15px #0004;
        font-size:12px;line-height:1.5;overflow-wrap:anywhere}
      strong,span{display:block}span{color:var(--bb-text-muted,#b3c0cc)}
      .app-update-actions{display:flex;gap:8px;flex-wrap:wrap}button{font:inherit;cursor:pointer}
      button:focus-visible{outline:2px solid currentColor;outline-offset:2px}button:disabled{cursor:default}`] })
export class AppUpdateNoticeComponent implements OnInit, OnDestroy {
    readonly updates = inject(AppUpdateService);
    ngOnInit(): void { this.updates.start(); }
    ngOnDestroy(): void { this.updates.stop(); }
}
