import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, Input, OnChanges, OnDestroy, signal } from '@angular/core';
import { messageCalendarDay, messageDayLabel } from '../../../core/i18n/message-day';
import { MessageDayClockService } from '../../../core/services/message-day-clock.service';
import { RegionalSettingsService } from '../../../core/services/regional-settings.service';

@Component({ selector: 'app-message-day-divider', standalone: true, imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div *ngIf="separator() as day" class="message-day-divider" role="separator" [attr.aria-label]="day.label">
    <time [attr.datetime]="day.key" [title]="day.fullDate + ' · ' + regional.timeZone()">{{ day.label }}</time>
  </div>`,
  styles: [`:host{display:contents}.message-day-divider{display:flex;align-items:center;gap:10px;min-width:0;margin:10px 0;padding:2px 0;color:var(--bb-text-muted,#b3c0cc);font-size:11px;line-height:1.5;text-align:center}
    .message-day-divider::before,.message-day-divider::after{content:'';flex:1;min-width:8px;border-top:1px solid var(--bb-border,#526071);opacity:.65}
    time{min-width:0;overflow-wrap:anywhere}`] })
export class MessageDayDividerComponent implements OnChanges, OnDestroy {
  readonly regional = inject(RegionalSettingsService);
  private readonly clock = inject(MessageDayClockService);
  private readonly release = this.clock.attach();
  private readonly timestamp = signal<string | null | undefined>(undefined);
  private readonly previous = signal<string | null | undefined>(undefined);
  @Input({ required: true }) set dateTime(value: string | null | undefined) { this.timestamp.set(value); }
  @Input() set previousDateTime(value: string | null | undefined) { this.previous.set(value); }
  readonly separator = computed(() => {
    const zone = this.regional.timeZone();
    const key = messageCalendarDay(this.timestamp(), zone);
    if (!key || key === messageCalendarDay(this.previous(), zone)) return null;
    return { key, label: messageDayLabel(key, this.clock.today(), this.regional.locale()), fullDate: this.regional.date(key) };
  });
  ngOnChanges(): void { this.clock.refresh(); }
  ngOnDestroy(): void { this.release(); }
}
