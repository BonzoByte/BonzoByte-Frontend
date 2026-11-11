import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, Input, signal } from '@angular/core';
import { initialsAvatar } from '../../../core/helpers/initials-avatar';

/** Fallback only. Existing image validation/loading stays with each message view. */
@Component({ selector: 'app-initials-avatar', standalone: true, imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush, host: { 'aria-hidden': 'true' },
  template: `<span class="bb-initials-avatar" [class.bb-initials-avatar-neutral]="!appearance().personalized"
    [style.background-color]="appearance().background" [style.color]="appearance().foreground">
    <span *ngIf="appearance().personalized; else neutralIcon" class="bb-avatar-letters">{{ appearance().initials }}</span>
    <ng-template #neutralIcon><i class="bi bi-person-fill" aria-hidden="true"></i></ng-template>
  </span>`,
  styles: [`:host{display:inline-flex;flex:0 0 100%;width:100%;height:100%;min-width:0;align-items:center;justify-content:center;border-radius:inherit}
    .bb-initials-avatar{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;height:100%;border-radius:var(--bb-avatar-radius,50%);overflow:hidden;background:var(--bb-control-bg,#202b34);color:var(--bb-text-muted,#b3c0cc);font-family:inherit;font-size:var(--bb-avatar-letter-size,12px);font-weight:700;line-height:1;user-select:none}
    .bb-avatar-letters{white-space:nowrap;line-height:1}.bi{font-size:var(--bb-avatar-icon-size,20px);line-height:1}`] })
export class InitialsAvatarComponent {
  private readonly publicIdentity = signal<string | null | undefined>(undefined);
  private readonly publicNickname = signal<string | null | undefined>(undefined);
  private readonly hiddenIdentity = signal(false);
  @Input() set identity(value: string | null | undefined) { this.publicIdentity.set(value); }
  @Input() set nickname(value: string | null | undefined) { this.publicNickname.set(value); }
  @Input() set neutral(value: boolean) { this.hiddenIdentity.set(value); }
  readonly appearance = computed(() => initialsAvatar(this.publicIdentity(), this.publicNickname(), this.hiddenIdentity()));
}
