import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('Subtle frosted report and catalog surfaces', () => {
    let fixture: HTMLElement, theme: ThemeService, originalTheme: string | undefined;
    beforeEach(() => {
        originalTheme = document.documentElement.dataset['bbTheme'];
        TestBed.configureTestingModule({}); theme = TestBed.inject(ThemeService);
        fixture = document.createElement('div');
        fixture.innerHTML = `<article class="mi-panel"><h2>Readable chart</h2><canvas></canvas></article>
          <section class="mi-hero__highlights"><div class="mi-stat-card">Nested highlight</div></section>
          <div class="mi-explainability__meta"><div>Accuracy</div></div>
          <div class="sql-study__cards"><article>Simulation result</article></div>
          ${['matches', 'players', 'tournaments'].map(host => `<app-${host}><div class="table-wrapper">
          <section class="tournament-group"><table class="match-table"><thead><tr><th>Date</th></tr></thead>
          <tbody><tr><td>First row</td></tr><tr><td>Second row</td></tr></tbody></table></section></div>
          <section class="bb-modal">Dialog outside grid</section></app-${host}>`).join('')}`;
        document.body.append(fixture);
    });
    afterEach(() => {
        fixture.remove();
        if (originalTheme) document.documentElement.dataset['bbTheme'] = originalTheme;
        else delete document.documentElement.dataset['bbTheme'];
    });
    const style = (selector: string) => getComputedStyle(fixture.querySelector(selector)!);
    const alpha = (colour: string) => {
        const sample = document.createElement('canvas').getContext('2d')!;
        sample.fillStyle = colour; sample.fillRect(0, 0, 1, 1);
        return sample.getImageData(0, 0, 1, 1).data[3] / 255;
    };
    for (const id of ['dark', 'light', 'wimbledon', 'roland-garros', 'us-open']) {
        it('keeps high-opacity theme-matched fills and crisp text in ' + id, () => {
            theme.setTheme(id, false);
            for (const selector of ['.mi-panel', '.mi-stat-card', '.mi-explainability__meta > div', '.sql-study__cards > article']) {
                expect(alpha(style(selector).backgroundColor)).toBeGreaterThanOrEqual(.89);
                expect(alpha(style(selector).backgroundColor)).toBeLessThan(1);
                expect(style(selector).opacity).toBe('1');
                expect(style(selector).filter).toBe('none');
            }
            expect(style('.mi-stat-card').backdropFilter).toBe('none');
            expect(style('.mi-panel canvas').filter).toBe('none');
        });
        it('uses one bounded grid effect, keeps sticky headings/dialogs solid in ' + id, () => {
            theme.setTheme(id, false);
            for (const host of ['app-matches', 'app-players', 'app-tournaments']) {
                const grid = (selector: string) => style(host + ' ' + selector);
                expect(alpha(grid('.match-table').backgroundColor)).toBe(0);
                expect(alpha(grid('.tournament-group').backgroundColor)).toBe(0);
                expect(alpha(grid('tbody tr').backgroundColor)).toBeGreaterThanOrEqual(.91);
                expect(alpha(grid('tbody tr').backgroundColor)).toBeLessThan(1);
                expect(grid('tbody tr').backdropFilter).toBe('none');
                expect(grid('tbody td').backdropFilter).toBe('none');
                expect(grid('tbody tr').transform).toBe('none');
                expect(alpha(grid('thead th').backgroundColor)).toBe(1);
                expect(alpha(grid('.bb-modal').backgroundColor)).toBe(1);
                expect(grid('.bb-modal').backdropFilter).toBe('none');
                const allowedBlur = matchMedia('(min-width:769px) and (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches;
                expect(grid('.table-wrapper').backdropFilter).toBe(allowedBlur ? 'blur(2px)' : 'none');
            }
        });
    }
});
