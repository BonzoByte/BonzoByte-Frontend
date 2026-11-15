import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('Lightweight stadium backgrounds and material theme surfaces', () => {
    let theme: ThemeService, fixture: HTMLElement;
    let initialTheme: string | undefined;
    beforeEach(() => {
        initialTheme = document.documentElement.dataset['bbTheme'];
        TestBed.configureTestingModule({}); theme = TestBed.inject(ThemeService);
        fixture = document.createElement('div');
        fixture.innerHTML = `<main class="main-content"><app-competition-page><div class="matches-page">
          <table class="match-table"><thead><tr><th>Match</th></tr></thead><tbody><tr><td>One</td></tr><tr><td>Two</td></tr></tbody></table>
          <article class="home-card">Readable card</article></div></app-competition-page></main>
          <section class="bb-modal">Readable dialog</section>
          <nav class="date-nav-sticky">Date and filters</nav>`;
        document.body.append(fixture);
    });
    afterEach(() => {
        fixture.remove();
        if (initialTheme) document.documentElement.dataset['bbTheme'] = initialTheme;
        else delete document.documentElement.dataset['bbTheme'];
    });
    const style = (selector: string) => getComputedStyle(fixture.querySelector(selector)!);
    const background = () => getComputedStyle(document.body, '::before');

    it('uses one pre-rendered theme-matched WebP without changing the base page colour', () => {
        for (const [id, colour] of [['dark', 'rgb(16, 20, 25)'], ['light', 'rgb(242, 245, 247)']]) {
            theme.setTheme(id, false); const body = background();
            expect(body.backgroundImage).toContain('tennis-stadium-' + id + '-v1');
            expect(body.backgroundImage).toMatch(/tennis-stadium-[^"')]+\.webp/);
            expect(body.backgroundImage).not.toContain('.svg');
            expect(body.backgroundImage).not.toContain('gradient');
            expect(body.backgroundImage).not.toContain('tennis-court-');
            expect(body.backgroundSize).toBe('cover'); expect(body.backgroundRepeat).toBe('no-repeat');
            expect(body.backgroundPosition).toBe('50% 50%');
            expect(body.backgroundColor).toBe(colour);
        }
    });
    it('shows through only outer wrappers and does not repaint table rows, headings, cards or dialogs', () => {
        for (const id of ['dark', 'light', 'wimbledon', 'roland-garros', 'us-open']) {
            theme.setTheme(id, false);
            for (const selector of ['main', 'app-competition-page', '.matches-page']) {
                expect(style(selector).backgroundImage).toBe('none'); expect(style(selector).backgroundColor).toBe('rgba(0, 0, 0, 0)');
            }
            for (const selector of ['th', 'tbody tr', '.home-card', '.bb-modal']) {
                expect(style(selector).backgroundImage).toBe('none'); expect(style(selector).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
            }
        }
    });
    for (const [id, colour] of [['wimbledon', 'rgb(16, 41, 29)'], ['roland-garros', 'rgb(59, 33, 26)'], ['us-open', 'rgb(7, 29, 58)']]) {
        it('uses a small shaded material PNG for ' + id + ' without changing its palette', () => {
            theme.setTheme(id, false); const body = background();
            expect(body.backgroundImage).toContain('surface-' + id);
            expect(body.backgroundImage).toMatch(/surface-[^"')]+\.png/);
            expect(body.backgroundImage).toContain('linear-gradient');
            const size = id === 'roland-garros' ? '640px 640px' : id === 'wimbledon' ? '512px 512px' : '640px 480px';
            expect(body.backgroundSize).toBe('auto, ' + size);
            expect(body.backgroundColor).toBe(colour);
            expect(body.backgroundBlendMode.split(',').every(mode => mode.trim() === 'normal')).toBeTrue();
        });
    }
    it('retains the Dark stadium when a theme has not yet been selected', () => {
        delete document.documentElement.dataset['bbTheme'];
        expect(background().backgroundImage).toContain('tennis-stadium-dark-v1');
        expect(background().backgroundSize).toBe('cover');
    });
    it('uses darker, coarser material tiles without leaking sizes between themes', () => {
        for (const [id, shade] of [['wimbledon', 'rgba(1, 5, 3, 0.86)'], ['roland-garros', 'rgba(2, 1, 0, 0.74)'], ['us-open', 'rgba(0, 3, 8, 0.15)']]) {
            theme.setTheme(id, false);
            expect(background().backgroundImage).toContain(shade);
        }
        theme.setTheme('roland-garros', false);
        expect(background().backgroundSize).toBe('auto, 640px 640px');
        theme.setTheme('wimbledon', false);
        expect(background().backgroundSize).toBe('auto, 512px 512px');
        theme.setTheme('us-open', false);
        expect(background().backgroundSize).toBe('auto, 640px 480px');
        theme.setTheme('dark', false);
        expect(background().backgroundSize).toBe('cover');
        expect(background().backgroundRepeat).toBe('no-repeat');
        theme.setTheme('light', false);
        expect(background().backgroundImage).toContain('tennis-stadium-light-v1');
        expect(background().backgroundSize).toBe('cover');
        expect(background().backgroundRepeat).toBe('no-repeat');
    });
    it('loads the new pre-rendered hard-court pattern only in the US Open theme', () => {
        theme.setTheme('us-open', false);
        expect(background().backgroundImage).toContain('surface-us-open-v2');
        for (const id of ['dark', 'light', 'wimbledon', 'roland-garros']) {
            theme.setTheme(id, false);
            expect(background().backgroundImage).not.toContain('surface-us-open-v2');
        }
    });
    it('uses a dark green Wimbledon toolbar and retains all other toolbar colours', () => {
        for (const [id, colour] of [
            ['dark', 'rgba(10, 10, 10, 0.72)'], ['light', 'rgba(248, 250, 252, 0.92)'],
            ['wimbledon', 'rgba(16, 41, 29, 0.96)'], ['roland-garros', 'rgba(137, 66, 34, 0.88)'],
            ['us-open', 'rgba(14, 57, 108, 0.9)'],
        ]) {
            theme.setTheme(id, false);
            expect(style('.date-nav-sticky').backgroundColor).toBe(colour);
        }
    });
    it('keeps one viewport-sized non-interactive composited backdrop on long pages', () => {
        fixture.style.minHeight = '3000px';
        for (const id of ['dark', 'light', 'wimbledon', 'roland-garros', 'us-open']) {
            theme.setTheme(id, false);
            const body = getComputedStyle(document.body);
            const before = getComputedStyle(document.body, '::before'), after = getComputedStyle(document.body, '::after');
            expect(before.content).toBe('""'); expect(['none', 'normal']).toContain(after.content);
            expect(body.isolation).toBe('isolate');
            expect(body.backgroundImage).toBe('none');
            expect(before.position).toBe('fixed');
            expect(before.top).toBe('0px'); expect(before.bottom).toBe('0px');
            expect(before.left).toBe('0px'); expect(before.right).toBe('0px');
            expect(parseFloat(before.height)).toBe(window.innerHeight);
            expect(parseFloat(before.width)).toBe(document.documentElement.clientWidth);
            expect(before.zIndex).toBe('-1'); expect(before.pointerEvents).toBe('none');
            expect(before.contain).toBe('strict'); expect(before.willChange).toBe('transform');
            expect(before.animationName).toBe('none'); expect(before.filter).toBe('none');
            expect(body.animationName).toBe('none'); expect(body.filter).toBe('none');
            expect(before.backgroundAttachment).not.toContain('fixed');
        }
    });
});
