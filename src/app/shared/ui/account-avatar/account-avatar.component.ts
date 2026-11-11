import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, Input, signal } from '@angular/core';
import { InitialsAvatarComponent } from '../initials-avatar/initials-avatar.component';

/** Account photos (including local upload previews) with the same fallback as messages. */
@Component({
  selector: 'app-account-avatar', standalone: true,
  imports: [CommonModule, InitialsAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'img', '[attr.aria-label]': 'alt' },
  template: `
    <img *ngIf="photoSource() as photo; else initials" [src]="photo" alt="" (error)="imageFailed(photo)" />
    <ng-template #initials>
      <app-initials-avatar [identity]="accountIdentity()" [nickname]="accountNickname()"></app-initials-avatar>
    </ng-template>`,
  styles: [`:host{display:inline-flex;align-items:center;justify-content:center;overflow:hidden;--bb-avatar-radius:0px}
    img{display:block;width:100%;height:100%;object-fit:cover;border-radius:inherit}`]
})
export class AccountAvatarComponent {
  readonly accountIdentity = signal<string | null | undefined>(undefined);
  readonly accountNickname = signal<string | null | undefined>(undefined);
  private readonly requestedPhoto = signal<string | null | undefined>(undefined);
  private readonly failedPhoto = signal<{ identity: string; source: string } | null>(null);

  @Input() set identity(value: string | null | undefined) { this.accountIdentity.set(value); }
  @Input() set nickname(value: string | null | undefined) { this.accountNickname.set(value); }
  @Input() set imageUrl(value: string | null | undefined) {
    if (value !== this.requestedPhoto()) this.failedPhoto.set(null);
    this.requestedPhoto.set(value);
  }
  @Input() alt = '';

  readonly photoSource = computed(() => {
    const source = this.requestedPhoto()?.trim();
    if (!source || /^(?:\.\/|\/)?assets\/images\/defaultUser\.png(?:[?#].*)?$/i.test(source)) return null;
    const failed = this.failedPhoto();
    return failed?.source === source && failed.identity === (this.accountIdentity() ?? '') ? null : source;
  });

  imageFailed(source: string): void {
    // A late failure from a previous photo must not hide a newly selected preview.
    if (source !== this.photoSource()) return;
    this.failedPhoto.set({ identity: this.accountIdentity() ?? '', source });
  }
}
