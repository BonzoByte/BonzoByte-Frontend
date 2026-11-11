import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Inject, Injectable, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_SNACK_BAR_DATA, MatSnackBar, MatSnackBarConfig, MatSnackBarModule, MatSnackBarRef } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { RegionalSettingsService } from '../services/regional-settings.service';
import { Subscription, take } from 'rxjs';
import { NoticeCountdown } from './notice-countdown';

interface LocalizedNotice { messageKey: string; actionKey: string; params: Record<string, string | number>; durationMs: number; }

@Component({
  selector: 'app-localized-snackbar',
  standalone: true,
  imports: [CommonModule, TranslateModule, MatSnackBarModule, MatButtonModule],
  template: `
    <span matSnackBarLabel>{{ data.messageKey | translate:data.params }}</span>
    <span matSnackBarActions>
      <button *ngIf="data.actionKey" class="bb-toast-action" mat-button matSnackBarAction
        (click)="ref.dismissWithAction()">{{ data.actionKey | translate }}</button>
      <button type="button" class="bb-toast-close" [attr.aria-label]="'common.close' | translate"
        [title]="'common.close' | translate" (click)="ref.dismiss()"><span aria-hidden="true">×</span></button>
    </span>
  `,
  styles: [`:host { display: flex; align-items: center; justify-content: space-between; overflow-wrap: anywhere; min-width: 0; }
    [matSnackBarLabel] { min-width: 0; }
    [matSnackBarActions] { flex-shrink: 0; gap: 4px; }
    .bb-toast-close { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
      width: 36px; height: 36px; padding: 0; border: 1px solid transparent; border-radius: 6px;
      font: inherit; font-size: 22px; line-height: 1; color: inherit; background: transparent; cursor: pointer; }
    .bb-toast-close:hover { border-color: currentColor; }
    .bb-toast-close:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }`]
})
export class LocalizedSnackbarComponent implements OnDestroy {
  private countdown: NoticeCountdown;
  private subscriptions = new Subscription();
  constructor(@Inject(MAT_SNACK_BAR_DATA) public data: LocalizedNotice,
    public ref: MatSnackBarRef<LocalizedSnackbarComponent>, private element: ElementRef<HTMLElement>) {
    this.countdown = new NoticeCountdown(data.durationMs, () => ref.dismiss());
    this.subscriptions.add(ref.afterOpened().pipe(take(1)).subscribe(() => this.countdown.start()));
    this.subscriptions.add(ref.afterDismissed().pipe(take(1)).subscribe(() => this.countdown.dispose()));
  }
  @HostListener('mouseenter') pausePointer(): void { this.countdown.pause('pointer'); }
  @HostListener('mouseleave') resumePointer(): void { this.countdown.resume('pointer'); }
  @HostListener('focusin') pauseFocus(): void { this.countdown.pause('focus'); }
  @HostListener('focusout', ['$event']) resumeFocus(event: FocusEvent): void {
    if (!this.element.nativeElement.contains(event.relatedTarget as Node | null)) this.countdown.resume('focus');
  }
  ngOnDestroy(): void { this.countdown.dispose(); this.subscriptions.unsubscribe(); }
}

/** Keeps an open notification translated even after its originating modal closes. */
@Injectable({ providedIn: 'root' })
export class LocalizedSnackbarService {
  private active?: { identity: string; ref: MatSnackBarRef<LocalizedSnackbarComponent> };
  constructor(private snack: MatSnackBar, private regional: RegionalSettingsService) {}

  open(messageKey: string, actionKey = '', config: MatSnackBarConfig = {}, params: Record<string, string | number> = {}): MatSnackBarRef<LocalizedSnackbarComponent> {
    const classes = typeof config.panelClass === 'string' ? [config.panelClass] : [...(config.panelClass ?? [])];
    const error = classes.includes('error-snackbar');
    const requested = Number.isFinite(config.duration) && (config.duration ?? 0) > 0 ? config.duration! : undefined;
    const durationMs = config.duration === 0 ? 0 : error ? Math.max(8000, requested ?? 0)
      : actionKey ? Math.max(5000, requested ?? 0) : Math.min(5000, Math.max(3000, requested ?? 3500));
    const position = { horizontalPosition: config.horizontalPosition ?? 'right', verticalPosition: config.verticalPosition ?? 'bottom' } as const;
    const politeness = config.politeness ?? (error ? 'assertive' : 'polite');
    const savedParams = { ...params };
    const identity = JSON.stringify([messageKey, actionKey, Object.entries(savedParams).sort(([a], [b]) => a.localeCompare(b)),
      classes.sort(), durationMs, position, config.direction ?? 'ltr', politeness]);
    // Material already shows only one notice; reusing its ref also avoids restarting
    // the timer or announcing the same message again on repeated clicks.
    if (this.active?.identity === identity) return this.active.ref;
    const ref = this.snack.openFromComponent(LocalizedSnackbarComponent, {
      ...config,
      ...position,
      duration: 0, // The public ref is dismissed by our pausable countdown, never Material's private timer.
      politeness,
      announcementMessage: this.regional.text(messageKey, params),
      data: { messageKey, actionKey, params: savedParams, durationMs }
    });
    this.active = { identity, ref };
    const clear = () => { if (this.active?.ref === ref) this.active = undefined; };
    ref.afterDismissed().pipe(take(1)).subscribe(clear);
    ref.onAction().pipe(take(1)).subscribe(clear);
    return ref;
  }
}
