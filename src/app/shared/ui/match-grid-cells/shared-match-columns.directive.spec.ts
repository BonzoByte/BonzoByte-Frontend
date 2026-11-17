import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SharedMatchColumnsDirective } from './shared-match-columns.directive';

@Component({ standalone: true, imports: [CommonModule, SharedMatchColumnsDirective], template: `
  <div class="matches-page"><div bbSharedMatchColumns>
    <section class="tournament-group" *ngFor="let row of rows">
      <header>Independent tournament</header>
      <table class="match-table"><colgroup><col style="width:400px"><col><col></colgroup>
        <thead><tr><th>{{ heading }}</th><th>Result</th><th>P/L</th></tr></thead>
        <tbody><tr><td>{{ row.name }}</td><td>{{ row.result }}</td><td>{{ row.pl }}</td></tr></tbody>
      </table>
    </section>
  </div></div>` })
class Harness {
  heading = 'Player';
  rows = [{ name: 'Short', result: '6:3 6:2', pl: '+0.60' },
    { name: 'An exceptionally long player display name (HRV) [1234]', result: '6:7(5) 7:6(7) 10:8', pl: '-1.00' }];
}

describe('Shared content-sized tournament columns', () => {
  let fixture: ComponentFixture<Harness>, directive: SharedMatchColumnsDirective;
  const widths = () => [...fixture.nativeElement.querySelectorAll('table')].map((table: unknown) =>
    [...(table as HTMLTableElement).tHead!.rows[0].cells].map(cell => cell.getBoundingClientRect().width));
  const paint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Harness] }).compileComponents();
    fixture = TestBed.createComponent(Harness); fixture.detectChanges();
    directive = fixture.debugElement.query(By.directive(SharedMatchColumnsDirective)).injector.get(SharedMatchColumnsDirective);
    await paint();
  });
  afterEach(() => fixture.destroy());

  it('shares the widest actual record in every column instead of old fixed widths', () => {
    const measured = widths();
    expect(measured[0]).toEqual(measured[1]);
    expect(measured[0][0]).toBeLessThan(400);
    expect(measured[0][0]).toBeGreaterThan(measured[0][2]);
    const tables = [...fixture.nativeElement.querySelectorAll('table')] as HTMLTableElement[];
    expect(tables[0].getBoundingClientRect().width).toBe(tables[1].getBoundingClientRect().width);
  });
  it('includes a translated header that is wider than all cell values', async () => {
    const before = widths()[0][0];
    fixture.componentInstance.heading = 'A translated header that is substantially wider than every player name shown in these grids';
    fixture.detectChanges(); await paint();
    expect(widths()[0][0]).toBeGreaterThan(before); expect(widths()[0]).toEqual(widths()[1]);
  });
  it('shrinks after filtering away the longest record, without mutating rows', async () => {
    const original = JSON.stringify(fixture.componentInstance.rows), before = widths()[0][0];
    const retained = fixture.componentInstance.rows[0]; fixture.componentInstance.rows = [retained];
    fixture.detectChanges(); await paint();
    expect(widths()[0][0]).toBeLessThan(before);
    expect(retained.name).toBe('Short'); expect(original).toContain('exceptionally long');
  });
  it('coalesces live cell text changes and keeps all groups aligned', async () => {
    const before = widths()[0][1];
    fixture.componentInstance.rows[0].result = '7:6(12) 6:7(15) 7:6(18) 6:7(20) 22:20';
    fixture.detectChanges(); await paint();
    expect(widths()[0][1]).toBeGreaterThan(before); expect(widths()[0]).toEqual(widths()[1]);
  });
  it('does not repeat measurement on unchanged checks and leaves no hidden probe', async () => {
    const measure = spyOn(directive, 'measureNow').and.callThrough();
    fixture.detectChanges(); fixture.detectChanges(); await paint();
    expect(measure).not.toHaveBeenCalled();
    expect(document.querySelector('.bb-group-columns-measure')).toBeNull();
  });
  it('cleans up pending work without touching real tables or data', async () => {
    const source = JSON.stringify(fixture.componentInstance.rows), measure = spyOn(directive, 'measureNow').and.callThrough();
    fixture.detectChanges(); fixture.destroy(); await paint();
    expect(measure).not.toHaveBeenCalled(); expect(JSON.stringify(fixture.componentInstance.rows)).toBe(source);
    expect(document.querySelector('.bb-group-columns-measure')).toBeNull();
  });
});
