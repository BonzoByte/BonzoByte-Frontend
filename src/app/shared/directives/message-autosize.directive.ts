import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { AfterViewInit, Directive, inject, NgZone, OnDestroy } from '@angular/core';

/** Re-measure once after projected modal content has inherited its final styles. */
@Directive({ selector: 'textarea[appMessageAutosize]', standalone: true })
export class MessageAutosizeDirective implements AfterViewInit, OnDestroy {
  private readonly autosize = inject(CdkTextareaAutosize, { self: true });
  private readonly zone = inject(NgZone);
  private destroyed = false;

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => queueMicrotask(() => {
      if (!this.destroyed) this.autosize.resizeToFitContent(true);
    }));
  }

  ngOnDestroy(): void { this.destroyed = true; }
}
