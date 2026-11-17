import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Directive, ElementRef, Inject, NgZone, OnDestroy } from '@angular/core';

/** Fits every tournament table to one intrinsic, content-sized column set. */
@Directive({ selector: '[bbSharedMatchColumns]', standalone: true })
export class SharedMatchColumnsDirective implements AfterViewInit, OnDestroy {
  private observer?: MutationObserver;
  private frame = 0;
  private resizeTimer = 0;
  private destroyed = false;
  private view: Window | null;
  private readonly resize = () => {
    if (!this.view) return;
    this.view.clearTimeout(this.resizeTimer);
    this.resizeTimer = this.view.setTimeout(() => this.schedule(), 100);
  };

  constructor(private host: ElementRef<HTMLElement>, @Inject(DOCUMENT) private document: Document, private zone: NgZone) {
    this.view = document.defaultView;
  }

  ngAfterViewInit(): void {
    if (!this.view) return;
    this.zone.runOutsideAngular(() => {
      // Style writes do not feed back into the observer. Ordinary change detection,
      // hover and scrolling also do not cause another measurement.
      this.observer = new MutationObserver(() => this.schedule());
      this.observer.observe(this.host.nativeElement, { childList: true, characterData: true, subtree: true });
      this.view!.addEventListener('resize', this.resize);
      this.document.fonts?.ready.then(() => this.schedule());
      this.schedule();
    });
  }

  private schedule(): void {
    if (this.destroyed || this.frame || !this.view) return;
    this.frame = this.view.requestAnimationFrame(() => { this.frame = 0; this.measureNow(); });
  }

  measureNow(): void {
    if (this.destroyed) return;
    const started = performance.now();
    const host = this.host.nativeElement;
    const tables = [...host.querySelectorAll<HTMLTableElement>('.tournament-group table.match-table')];
    const first = tables[0];
    const count = first?.tHead?.rows[0]?.cells.length || 0;
    if (!count || tables.some(table => table.tHead?.rows[0]?.cells.length !== count)) return;

    // One offscreen native table lets the browser find the widest record in each
    // column across ALL groups, including fonts, flags, widgets and multi-line sets.
    // Its inert clones cannot run Angular handlers, receive focus or be announced.
    const wrapper = this.document.createElement('div');
    wrapper.className = 'matches-page-wrapper matches-page bb-group-columns-measure';
    wrapper.setAttribute('aria-hidden', 'true'); wrapper.setAttribute('inert', '');
    wrapper.style.cssText = 'position:fixed;left:-100000px;top:0;width:max-content;height:auto;visibility:hidden;pointer-events:none;contain:layout style;';
    const probe = first.cloneNode(false) as HTMLTableElement;
    probe.style.setProperty('width', 'max-content', 'important');
    probe.style.setProperty('min-width', '0', 'important');
    probe.style.setProperty('max-width', 'none', 'important');
    probe.style.setProperty('table-layout', 'auto', 'important');
    probe.appendChild(first.tHead!.cloneNode(true));
    const body = this.document.createElement('tbody');
    for (const table of tables) for (const section of Array.from(table.tBodies))
      for (const row of Array.from(section.rows)) body.appendChild(row.cloneNode(true));
    probe.appendChild(body);
    for (const node of Array.from(probe.querySelectorAll<HTMLElement>('[id]'))) node.removeAttribute('id');
    for (const cell of Array.from(probe.querySelectorAll<HTMLElement>('th,td'))) {
      for (const [name, value] of Object.entries({ width: 'auto', 'min-width': '0', 'max-width': 'none',
        'padding-left': '4px', 'padding-right': '4px', position: 'static' })) cell.style.setProperty(name, value, 'important');
    }
    for (const node of Array.from(probe.querySelectorAll<HTMLElement>(
      '.matchup-cell__content,.match-result-cell__content,.matchup-player,app-match-players-cell,app-match-result-cell'))) {
      node.style.setProperty('width', 'max-content', 'important');
      node.style.setProperty('max-width', 'none', 'important');
    }
    for (const node of Array.from(probe.querySelectorAll<HTMLElement>('.responsive-label,.prediction-cell__player,.prediction-cell__market-copy'))) {
      node.style.setProperty('max-width', 'none', 'important');
      node.style.setProperty('overflow', 'visible', 'important');
      node.style.setProperty('flex-shrink', '0', 'important');
    }
    wrapper.appendChild(probe); this.document.body.appendChild(wrapper);
    try {
      const widths = Array.from(probe.tHead!.rows[0].cells).map(cell => Math.ceil(cell.getBoundingClientRect().width));
      if (widths.some(width => !Number.isFinite(width) || width <= 0 || width > 100000)) return;
      const total = widths.reduce((sum, width) => sum + width, 0) + 1;
      for (const table of tables) {
        const columns = table.querySelectorAll<HTMLTableColElement>('colgroup > col');
        if (columns.length !== count) continue;
        columns.forEach((column, index) => column.style.setProperty('width', `${widths[index]}px`, 'important'));
        table.style.setProperty('table-layout', 'fixed');
        table.style.setProperty('width', `${total}px`, 'important');
        table.style.setProperty('max-width', 'none', 'important');
        const group = table.closest<HTMLElement>('.tournament-group');
        if (group) { group.style.width = `${total}px`; group.style.boxSizing = 'content-box'; }
      }
      host.dataset['bbColumnWidths'] = widths.join(',');
      host.dataset['bbSizingPasses'] = String(Number(host.dataset['bbSizingPasses'] || 0) + 1);
      host.dataset['bbSizingMs'] = String(Math.round((performance.now() - started) * 10) / 10);
    } finally { wrapper.remove(); }
  }

  ngOnDestroy(): void {
    this.destroyed = true; this.observer?.disconnect();
    this.view?.cancelAnimationFrame(this.frame); this.view?.clearTimeout(this.resizeTimer);
    this.view?.removeEventListener('resize', this.resize);
  }
}
