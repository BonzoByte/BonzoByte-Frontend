// Loopback-only visual/control review. Synthetic guest/opponent; never reaches a real API.
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.BONZO_REVIEW_NODE_MODULES, 'playwright'));

async function main() {
  const build = path.resolve(process.argv[2]), output = path.resolve(process.argv[3]);
  await fs.mkdir(output); // A new review, never an overwrite of earlier evidence.
  const version = (await fs.readFile(path.join(__dirname, '../src/app/arcade/tennis-kernel-version.ts'), 'utf8')).match(/[a-f0-9]{64}/)[0];
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.ico': 'image/x-icon' };
  const server = http.createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405).end();
    try {
      const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(build, '.' + route);
      if (file !== build && !file.startsWith(build + path.sep)) return res.writeHead(403).end();
      const asset = route === '/tennis-break' || route === '/' ? path.join(build, 'index.html') : file;
      const bytes = await fs.readFile(asset);
      res.setHeader('Content-Type', types[path.extname(asset)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store'); res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const checks = [], errors = [], blocked = [], writes = [];
  let browser;
  try {
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(request.method())) { writes.push(url.pathname); return route.abort(); }
        const body = url.pathname.endsWith('/arcade/opponents') ? { engineVersion: version, items: [{ id: 900001, name: 'QA Strong Opponent', countryISO2: 'hr', countryISO3: 'HRV', ts: 38, lastMatch: '2026-11-10', strength: 1 }] }
          : url.pathname.endsWith('/auth/me') ? { user: null } : { ok: true, enabled: false, count: 0, unreadCount: 0, items: [] };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (url.origin !== origin) { blocked.push(url.origin + url.pathname); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/tennis-break', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.ng?.getComponent(document.querySelector('app-tennis-break')));
    assert.equal(await page.locator('.display-settings-options').isVisible(), false);
    assert.equal(await page.locator('.match-score thead').textContent().then(s => /Sets.*Games.*Points/s.test(s)), true);
    checks.push('Baseline camera, hidden settings menu and complete sets/games/points scoreboard.');
    await page.getByRole('combobox', { name: /Choose.*opponent/i }).fill('QA');
    await page.getByRole('option', { name: /QA Strong Opponent/ }).click();
    await page.getByRole('button', { name: /Full screen/ }).click();
    await page.getByRole('button', { name: /Step onto court/ }).click();
    await page.evaluate(() => { const p = window.ng.getComponent(document.querySelector('app-tennis-break')); p.stop(); window.__gameReview = p; });
    const frame = async seconds => page.evaluate(seconds => {
      const p = window.__gameReview;
      for (let left = seconds; left > 1e-8;) { const dt = Math.min(1 / 120, left); p.game.update(dt, p.input()); left -= dt; }
      p.sync(); p.paint(performance.now());
      return { phase: p.game.phase, depth: p.game.serveDepth, aim: p.game.serveAim, power: p.game.serveCharge, toss: p.game.serveTossActive,
        progress: p.game.serveTossProgress, queued: p.game.serveReleaseQueued, ball: { ...p.game.ball }, renderedBall: p.renderer.ball.position.toArray(),
        crew: p.renderer.scene.getObjectByName('tennis-ball-crew')?.children.length, score: [...p.game.score], attempt: p.game.serveAttempt,
        opponent: p.career.selected()?.name, strength: p.game.opponentStrength };
    }, seconds);
    const ready = await frame(.02);
    assert.equal(ready.toss, false); assert.equal(ready.crew, 3); assert.equal(ready.opponent, 'QA Strong Opponent');
    assert.ok(ready.strength > .9);
    await page.screenshot({ path: path.join(output, 'baseline-ready.png') });
    await page.keyboard.down('Space'); await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowUp');
    const rising = await frame(.5);
    await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowUp');
    assert.equal(rising.phase, 'serving'); assert.equal(rising.toss, true); assert.ok(rising.ball.y > ready.ball.y + 1);
    assert.ok(rising.aim > .7 && rising.depth > .7 && rising.power > .4);
    assert.deepEqual(rising.renderedBall, [rising.ball.x, rising.ball.y, rising.ball.z]);
    await page.screenshot({ path: path.join(output, 'toss-aim-depth.png') });
    await page.keyboard.up('Space'); const queued = await frame(.02);
    assert.equal(queued.queued, true); assert.equal(queued.phase, 'serving');
    assert.equal(await page.locator('.serve-depth-options button:disabled').count(), 3);
    const top = await frame(.25); assert.ok(top.ball.y > rising.ball.y);
    await page.screenshot({ path: path.join(output, 'toss-trophy.png') });
    const contact = await frame(.31); assert.equal(contact.phase, 'playing'); assert.equal(contact.toss, false);
    assert.deepEqual(contact.score, [0, 0]);
    await page.screenshot({ path: path.join(output, 'overarm-contact.png') });
    checks.push('Actual keyboard toss, moving physical ball, simultaneous power/width/depth, frozen release, then overhead contact.');
    // Fresh synthetic point: touch controls share replay commands and the same physical toss.
    await page.evaluate(() => { const p = window.__gameReview; p.clearInput(); p.game.start(); p.sync(); p.paint(); });
    await page.getByRole('group', { name: 'Serve depth', exact: true }).getByRole('button', { name: /Near/ }).click();
    assert.equal((await frame(0)).depth, -1);
    await page.getByRole('group', { name: 'Serve depth', exact: true }).getByRole('button', { name: /Deep/ }).click();
    assert.equal((await frame(0)).depth, 1);
    assert.equal(await page.locator('canvas').evaluate(el => el === document.activeElement), true);
    checks.push('Depth buttons work and restore keyboard focus without changing the selected opponent.');
    // Pause during a new airborne toss: it must be caught without spending a service attempt.
    await page.keyboard.down('Space'); await frame(.35); await page.keyboard.press('p'); await page.keyboard.up('Space');
    const paused = await frame(0); assert.equal(paused.toss, false); assert.equal(paused.attempt, 1); assert.deepEqual(paused.score, [0, 0]);
    checks.push('Pausing safely cancels an airborne toss, preserving score and service attempt.');
    await page.evaluate(() => { const p = window.__gameReview; p.paused.set(false); p.game.start(); p.sync(); p.paint(); });
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size); await page.waitForTimeout(200);
      const geometry = await page.evaluate(() => {
        const bounds = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
        return { court: bounds('.court-window'), score: bounds('.match-score'), controls: bounds('.play-controls'), hit: bounds('.hit-touch'),
          overflow: document.querySelector('.game-panel').scrollWidth > innerWidth + 1 };
      });
      assert.ok(geometry.court.height > 100); assert.ok(geometry.score.x >= 0 && geometry.score.right <= size.width + 1);
      assert.equal(geometry.overflow, false); assert.ok(geometry.controls.width <= size.width + 1);
      if (size.width <= 700) assert.ok(geometry.hit.bottom <= geometry.controls.bottom + 1, 'Touch serve must be reachable without scrolling the control area.');
      await page.screenshot({ path: path.join(output, `fullscreen-${size.width}x${size.height}.png`) });
      checks.push(`Fitted ${size.width}×${size.height}: scoreboard, court and controls remain visible, no horizontal overflow.`);
    }
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    await fs.writeFile(path.join(output, 'complete.json'), JSON.stringify({ complete: true, version, checks, pageErrors: errors, blocked, writes,
      realApiRequests: 0, localOnly: true, accountsModified: false, archivesModified: false, modelsModified: false,
      note: 'Deterministic review frames in a fresh guest tab. Software WebGL is visual validation, not an FPS benchmark.' }, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ complete: true, output, checks }, null, 2));
  } catch (error) {
    await fs.writeFile(path.join(output, 'failed.json'), JSON.stringify({ error: String(error), errors, checks, writes }, null, 2), { flag: 'wx' });
    throw error;
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
