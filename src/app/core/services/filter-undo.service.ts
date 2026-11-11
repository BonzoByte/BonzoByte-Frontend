import { Injectable, Injector, OnDestroy } from '@angular/core';
import { MatSnackBarRef } from '@angular/material/snack-bar';
import { Subscription, take } from 'rxjs';
import { LocalizedSnackbarComponent, LocalizedSnackbarService } from '../i18n/localized-snackbar.service';
import { BrowseVisit } from './browse-memory.service';

/** App-scoped, single-use undo. Holds small view settings only for the lifetime of its toast. */
@Injectable()
export class FilterUndoService implements OnDestroy {
  private serial = 0;
  private active?: { owner: object; ref: MatSnackBarRef<LocalizedSnackbarComponent>; subscriptions: Subscription };
  constructor(private injector: Injector) {}

  offer<T>(owner: object, previous: BrowseVisit<T> | null, current: T, restore: (visit: BrowseVisit<T>) => void | boolean): void {
    this.clear();
    if (!previous) return;
    const scrolled = [previous.scroll.window, previous.scroll.main, ...Object.values(previous.scroll.regions).flat()]
      .some(point => point && (point.top !== 0 || point.left !== 0));
    if (JSON.stringify(previous.state) === JSON.stringify(current) && !scrolled) return;
    try {
      const snack = this.injector.get(LocalizedSnackbarService);
      const ref = snack.open('filterUndo.changed', 'filterUndo.undo', { duration: 10000 }, { undoId: ++this.serial });
      const token = { owner, ref, subscriptions: new Subscription() };
      this.active = token;
      token.subscriptions.add(ref.onAction().pipe(take(1)).subscribe(() => {
        if (this.active !== token) return;
        this.clear();
        if (restore(previous) !== false)
          snack.open('filterUndo.restored', '', { duration: 3000, panelClass: 'success-snackbar' });
      }));
      token.subscriptions.add(ref.afterDismissed().pipe(take(1)).subscribe(() => {
        if (this.active === token) this.clear(false);
      }));
    } catch {
      // An unavailable notification must never interrupt filtering.
      this.clear();
    }
  }

  cancel(owner: object): void { if (this.active?.owner === owner) this.clear(); }
  private clear(dismiss = true): void {
    const active = this.active;
    this.active = undefined;
    active?.subscriptions.unsubscribe();
    if (dismiss) active?.ref.dismiss();
  }
  ngOnDestroy(): void { this.clear(); }
}
