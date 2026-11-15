// Loopback-only visual/performance regression. No accounts, live APIs or writes to data archives.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const sass = require('sass');
const runtime = 'C:/Users/Stanko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = require(path.join(runtime, 'playwright'));
const sharp = require(path.join(runtime, 'sharp'));

(async () => {
    const project = path.resolve(__dirname, '..');
    const output = path.resolve(process.argv[2] || path.join(project, 'dist/stadium-scroll-review'));
    await fs.mkdir(output, { recursive: true });
    const css = sass.compile(path.join(project, 'src/styles.scss'), { loadPaths: [path.join(project, 'node_modules')] }).css;
    const themes = ['dark', 'light', 'wimbledon', 'roland-garros', 'us-open'];
    const html = `<!doctype html><html data-bb-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="stylesheet" href="/styles.css"><style>
      body{--header-h:76px;--footer-h:36px;--datebar-h:0px}.custom-header{padding:24px;box-sizing:border-box}
      main{width:min(820px,calc(100% - 40px));margin:12px auto;min-height:3400px}
      .home-card{height:280px;margin-bottom:24px;border:1px solid var(--bb-border);border-radius:16px;padding:20px}
      .probe{position:fixed;top:20px;right:20px;z-index:12001}.custom-footer{padding:10px;box-sizing:border-box}
      .fixture-dialog{position:fixed;left:10%;right:10%;top:35%;padding:40px;background:var(--bb-surface-1);z-index:20001}
      body.flat::before{content:none!important}
      </style></head><body><header class="custom-header">BONZOBYTE</header><button class="probe">Input probe</button>
      <main class="main-content"><section class="analytics-page"><h1>Analytics</h1>
      ${Array.from({ length: 10 }, (_, i) => `<article class="home-card">Report section ${i + 1}</article>`).join('')}
      </section></main><footer class="custom-footer">BonzoByte</footer></body></html>`;
    const server = http.createServer(async (request, response) => {
        const url = new URL(request.url, 'http://127.0.0.1');
        if (request.method !== 'GET') { response.writeHead(405).end(); return; }
        if (url.pathname === '/') { response.setHeader('Content-Type', 'text/html'); response.end(html); return; }
        if (url.pathname === '/styles.css') { response.setHeader('Content-Type', 'text/css'); response.end(css); return; }
        const asset = url.pathname.match(/^\/assets\/backgrounds\/(tennis-stadium-(?:dark-v2|(?:light|wimbledon|roland-garros|us-open)-v1)\.webp)$/);
        if (asset) {
            response.setHeader('Content-Type', asset[1].endsWith('.png') ? 'image/png' : 'image/webp');
            response.end(await fs.readFile(path.join(project, 'src/assets/backgrounds', asset[1]))); return;
        }
        response.writeHead(404).end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const checks = [], perf = [];
    try {
        for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
            const context = await browser.newContext({ viewport });
            await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
            const page = await context.newPage();
            await page.goto(origin, { waitUntil: 'networkidle' });
            for (const theme of themes) {
                await page.evaluate(async theme => {
                    document.documentElement.dataset.bbTheme = theme; window.scrollTo(0, 0);
                    const urls = [...getComputedStyle(document.body, '::before').backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)];
                    await Promise.all(urls.map(async match => { const image = new Image(); image.src = match[1]; await image.decode(); }));
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                }, theme);
                const crop = async () => sharp(await page.screenshot()).extract({ left: 2, top: 100, width: 5, height: viewport.height - 160 }).raw().toBuffer();
                const before = await crop();
                await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
                await page.waitForTimeout(100);
                const after = await crop();
                const delta = Math.max(...after.map((value, i) => Math.abs(value - before[i])));
                // Chromium can select a slightly different GPU resampling path
                // after scrolling. A missing/moving background differs far more.
                assert.ok(delta <= 8, 'Backdrop moved or ended: ' + theme + '/' + viewport.width + '; max channel delta=' + delta);
                const position = await page.evaluate(() => ({ scroll: scrollY, viewport: innerHeight,
                    backdrop: parseFloat(getComputedStyle(document.body, '::before').height) }));
                assert.ok(position.scroll > viewport.height); assert.equal(position.backdrop, position.viewport);
                await page.screenshot({ path: path.join(output, 'bottom-' + theme + '-' + viewport.width + '.png') });
                checks.push({ theme, width: viewport.width, bottomScroll: position.scroll, fixedBackgroundPixels: true, maxChannelDelta: delta });
            }
            await page.locator('.probe').click();
            await page.evaluate(() => {
                const modal = document.createElement('section'); modal.className = 'fixture-dialog';
                modal.innerHTML = '<button id="close-dialog">Close dialog</button>'; document.body.append(modal);
                modal.querySelector('button').onclick = () => modal.remove();
            });
            await page.locator('#close-dialog').click();
            assert.equal(await page.locator('.fixture-dialog').count(), 0);
            for (const flat of [false, true]) {
                const measured = await page.evaluate(async flat => {
                    document.body.classList.toggle('flat', flat); window.scrollTo(0, 0);
                    const gaps = []; let previous = performance.now();
                    await new Promise(resolve => { let frame = 0; const step = now => {
                        gaps.push(now - previous); previous = now; scrollBy(0, 24);
                        if (++frame < 90) requestAnimationFrame(step); else resolve();
                    }; requestAnimationFrame(step); });
                    const sorted = gaps.slice(1).sort((a, b) => a - b);
                    return { p95FrameMs: sorted[Math.floor(sorted.length * .95)], maxFrameMs: Math.max(...sorted) };
                }, flat);
                perf.push({ width: viewport.width, flat, ...measured });
            }
            await context.close();
        }
        const report = { passed: true, checks, perf, modalRemainsClickable: true, liveApisUsed: false };
        await fs.writeFile(path.join(output, 'complete.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report));
    } finally {
        await browser.close(); await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
