import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, NgZone, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { dayAt } from '../i18n/archive-day-window';
import { RegionalSettingsService } from './regional-settings.service';

/** Shared presentation clock, active only while message rows exist. No polling or writes. */
@Injectable({ providedIn: 'root' })
export class MessageDayClockService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly view = this.document.defaultView;
  private readonly zone = inject(NgZone);
  private readonly regional = inject(RegionalSettingsService);
  private readonly instant = signal(Date.now());
  readonly today = computed(() => dayAt(this.instant(), this.regional.timeZone()));
  private readonly owners = new Set<object>();
  private lastMinute = -1;
  private zoneChanges?: Subscription;
  private destroyed = false;
  private readonly interaction = () => this.refresh();
  private readonly returned = () => {
    if (this.document.visibilityState !== 'hidden') this.refresh(true);
  };

  attach(): () => void {
    if (this.destroyed) return () => {};
    const owner = {};
    this.owners.add(owner);
    if (this.owners.size === 1) {
      this.refresh(true);
      this.zoneChanges = this.regional.timeZoneChanges.subscribe(() => this.refresh(true));
      this.zone.runOutsideAngular(() => {
        this.document.addEventListener('visibilitychange', this.returned);
        this.view?.addEventListener('focus', this.returned);
        for (const event of ['pointerdown', 'keydown', 'wheel'])
          this.view?.addEventListener(event, this.interaction, { passive: true });
      });
    }
    return () => {
      if (this.owners.delete(owner) && !this.owners.size) this.detach();
    };
  }

  /** Refresh on new rows, a return to the tab or user activity; never tick the whole app. */
  refresh(force = false): void {
    if (this.destroyed) return;
    const now = Date.now(), minute = Math.floor(now / 60000);
    if (!force && minute === this.lastMinute) return;
    this.lastMinute = minute;
    if (dayAt(now, this.regional.timeZone()) !== this.today())
      this.zone.run(() => this.instant.set(now));
  }

  private detach(): void {
    this.zoneChanges?.unsubscribe();
    this.zoneChanges = undefined;
    this.document.removeEventListener('visibilitychange', this.returned);
    this.view?.removeEventListener('focus', this.returned);
    for (const event of ['pointerdown', 'keydown', 'wheel']) this.view?.removeEventListener(event, this.interaction);
  }

  ngOnDestroy(): void { this.destroyed = true; this.owners.clear(); this.detach(); }
}
