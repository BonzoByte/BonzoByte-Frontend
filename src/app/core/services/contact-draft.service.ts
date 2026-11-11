import { Inject, Injectable, OnDestroy, Optional } from '@angular/core';
import { distinctUntilChanged, map, Subject, Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { DraftUnloadGuardService } from './draft-unload-guard.service';

export interface ContactDraft { name: string; email: string; message: string; }

/** One contact draft in tab memory only: no storage, network, tracking or auto-send. */
@Injectable({ providedIn: 'root' })
export class ContactDraftService implements OnDestroy {
  private draft: ContactDraft | null = null;
  private version = 0;
  private destroyed = false;
  private readonly accountSubscription: Subscription;
  private readonly releaseUnload?: () => void;
  readonly scopeChanged = new Subject<void>();
  get scopeVersion(): number { return this.version; }

  constructor(auth: AuthService,
    @Optional() @Inject(DraftUnloadGuardService) private unload: DraftUnloadGuardService | null = null) {
    this.releaseUnload = unload?.register(() => !!this.draft && Object.values(this.draft).some(text => !!text.trim()));
    this.accountSubscription = auth.user$.pipe(
      map(user => user?._id || null), distinctUntilChanged()
    ).subscribe(() => {
      this.draft = null; this.version++; this.unload?.refresh(); this.scopeChanged.next();
    });
  }

  read(): ContactDraft | null { return this.draft ? { ...this.draft } : null; }

  save(value: Partial<ContactDraft>, scopeVersion: number): void {
    if (this.destroyed || scopeVersion !== this.version) return;
    const draft = {
      name: typeof value.name === 'string' ? value.name : '',
      email: typeof value.email === 'string' ? value.email : '',
      message: typeof value.message === 'string' ? value.message : '',
    };
    this.draft = Object.values(draft).some(text => text.length > 0) ? draft : null;
    this.unload?.refresh();
  }

  clear(scopeVersion: number): void {
    if (!this.destroyed && scopeVersion === this.version) { this.draft = null; this.unload?.refresh(); }
  }

  confirmed(sent: ContactDraft, scopeVersion: number): void {
    if (this.draft && this.draft.name === sent.name && this.draft.email === sent.email && this.draft.message === sent.message)
      this.clear(scopeVersion);
  }

  ngOnDestroy(): void {
    this.destroyed = true; this.version++; this.draft = null;
    this.releaseUnload?.();
    this.accountSubscription.unsubscribe(); this.scopeChanged.complete();
  }
}
