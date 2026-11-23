import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [build, playwright, executablePath] = process.argv.slice(2);
assert.ok(build && playwright && executablePath);
const origin = 'http://bonzobyte-model-display.test', key = '20261119', date = '2026-11-19';
const asset = name => new URL('../src/assets/model-display/' + name, import.meta.url);
const feed = JSON.parse(await readFile(asset(key + '.json'), 'utf8'));
const archive = await fetch('https://bonzobyte.com/api/archives/daily/' + key, { signal: AbortSignal.timeout(15000), redirect: 'error' });
assert.equal(archive.status, 200);
const actual = await archive.json();
assert.equal(feed.rows.length, 22);
for (const [tp, id, p1, p2, event] of feed.rows) {
    const rows = actual.matches.filter(match => match.matchTPId === tp);
    assert.equal(rows.length, 1);
    const [m] = rows;
    assert.deepEqual([m.matchId, m.player1TPId, m.player2TPId, m.tournamentEventTPId], [id, p1, p2, event]);
    assert.equal(m.modelProbabilityPlayer1, null);
}
const { chromium } = await import(pathToFileURL(playwright));
const browser = await chromium.launch({ executablePath, headless: true });
const media = { js: 'application/javascript', html: 'text/html', css: 'text/css', json: 'application/json',
    svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', woff2: 'font/woff2' };
let verified = 0;
try {
    for (const [lang, width] of [['en', 1440], ['hr', 390]]) {
        const context = await browser.newContext({ viewport: { width, height: 920 }, timezoneId: 'Europe/Zagreb', serviceWorkers: 'block' });
        await context.addInitScript(language => localStorage.setItem('bonzobyte.ui.language.v1', language), lang);
        await context.route('**/*', async route => {
            const req = route.request(), u = new URL(req.url()), request = u.pathname;
            if (u.origin !== origin) return route.abort();
            if (!['GET', 'HEAD'].includes(req.method())) return route.fulfill({ json: { counts: [] } });
            if (request === '/api/archives/available-dates') return route.fulfill({ json: [date] });
            if (request === '/api/archives/daily/' + key) return route.fulfill({ json: actual });
            if (request === '/api/archives/latest-daily') return route.fulfill({ json: { date: key, iso: date } });
            if (request === '/api/archives/daterange') return route.fulfill({ json: { minDate: date, maxDate: date } });
            if (request.startsWith('/api/')) return route.fulfill({ status: 404, json: {} });
            const source = request.match(/^\/assets\/model-display\/(index|20261119)\.json$/);
            if (source) return route.fulfill({ contentType: media.json, body: await readFile(asset(source[1] + '.json')) });
            if (request.includes('..') || !/^\/[a-zA-Z0-9_./-]*$/.test(request)) return route.abort();
            const file = request === '/' || request === '/matches' ? 'index.html' : request.slice(1);
            try {
                await route.fulfill({ contentType: media[path.extname(file).slice(1)], body: await readFile(path.join(build, file)) });
            } catch { await route.fulfill({ status: 404 }); }
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));
        const publishedPacket = page.waitForResponse(r => r.url().endsWith('/model-display/' + key + '.json') && r.ok());
        await page.goto(origin + '/matches', { waitUntil: 'domcontentloaded' });
        await publishedPacket;
        const match = page.locator('tr[data-match-id="827551782"]');
        const price = match.locator('.market-odds-cell__values');
        await price.waitFor({ state: 'visible' });
        const whole = await match.locator('.market-odds-cell__integer').allTextContents();
        const fraction = await match.locator('.market-odds-cell__fraction').allTextContents();
        assert.deepEqual(whole.map((val, i) => Number(val.trim() + '.' + fraction[i].trim())), [1.88, 2.13]);
        assert.match(await match.locator('.market-odds-cell').getAttribute('title'),
            lang === 'hr' ? /izračunate naknadno/ : /calculated later/);
        const prediction = match.locator('.prediction-cell');
        assert.match(await prediction.locator('.prediction-cell__topline').innerText(), /53[.,]14\s*%/);
        assert.match(await prediction.locator('.prediction-cell__outcome').innerText(), lang === 'hr' ? /neocijenjeno/i : /not scored/i);
        assert.match(await prediction.getAttribute('title'), lang === 'hr' ? /ne ulazi u statistiku/i : /not included in accuracy/i);
        assert.match(await prediction.getAttribute('class'), /prediction-cell--ungraded/);
        assert.doesNotMatch(await prediction.getAttribute('class'), /prediction-cell--(?:correct|incorrect)/);
        assert.ok(await page.locator('.prediction-cell--correct').count() > 0);
        assert.match(await match.locator('.match-result-cell').innerText(),
            lang === 'hr' ? /nepotvrđ|nije (?:potvrđen|provjeren)/i : /unverified/i);
        assert.deepEqual(errors, []);
        ++verified;
        await context.close();
    }
} finally { await browser.close(); }
console.log(JSON.stringify({ passed: true, verifiedLocales: verified, matchedSupplementRows: feed.rows.length, productionWrites: 0 }));
