import { Directive, ElementRef, HostListener, Input, OnDestroy } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { DraftUnloadGuardService } from '../../core/services/draft-unload-guard.service';

/** Also protects active over-limit text that deliberately isn't saved as a draft. */
@Directive({ selector: 'textarea[appDraftUnloadGuard]', standalone: true })
export class DraftUnloadDirective implements OnDestroy {
  private hasText = false;
  private actor = '';
  private readonly unregister: () => void;

  constructor(private element: ElementRef<HTMLTextAreaElement>, private auth: AuthService,
    private guard: DraftUnloadGuardService) {
    this.unregister = guard.register(() => this.hasText && this.actor === this.currentActor());
  }

  @Input() set appDraftUnloadGuard(value: unknown) { this.update(value); }

  @HostListener('input') onInput(): void { this.update(this.element.nativeElement.value); }

  private currentActor(): string { return this.auth.getUser?.()?._id || ''; }
  private update(value: unknown): void {
    this.actor = this.currentActor();
    this.hasText = typeof value === 'string' && value.trim().length > 0;
    this.guard.refresh();
  }

  ngOnDestroy(): void { this.unregister(); }
}
