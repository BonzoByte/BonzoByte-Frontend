// Loopback-only CSS, readability and scrolling comparison. No API/account/data writes.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const sass = require('sass');
const runtime = 'C:/Users/Stanko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = require(path.join(runtime, 'playwright'));
(async () => {
    const project = path.resolve(__dirname, '..');
    const output = path.resolve(process.argv[2] || path.join(project, 'dist/frosted-surfaces-review'));
    await fs.mkdir(output, { recursive: true });
    const css = sass.compile(path.join(project, 'src/styles.scss'), { loadPaths: [path.join(project, 'node_modules')] }).css;
    const html = `<!doctype html><html data-bb-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="stylesheet" href="/styles.css"><style>
      body{--header-h:0px;--footer-h:0px;--datebar-h:0px;padding:0}
      main{width:min(1100px,calc(100% - 32px));margin:12px auto}
      .cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
      .mi-panel{padding:20px;min-height:250px;border:1px solid var(--bb-border);border-radius:22px}
      .mi-panel p{color:var(--bb-text-muted)}.mi-panel h2{color:var(--bb-text-strong)}
      .chart{height:130px;background:linear-gradient(180deg,transparent 95%,#8999a822 95%) 0 0/100% 25px;display:flex;gap:5%;align-items:end}
      .chart i{width:16%;background:#1fbf99;height:70%}.chart i:nth-child(2n){height:40%;background:#3ca4eb}
      app-matches,app-players,app-tournaments{display:block;margin:20px 0}.table-wrapper{height:520px;overflow:auto}
      .match-table{width:100%;margin:0}.match-table thead th{top:0}.match-table td{height:32px}
      .tournament-group{overflow:hidden;border-radius:10px;border:1px solid var(--bb-border)}
      .probe{position:fixed;top:10px;right:10px;z-index:12001}
      .bb-modal{position:fixed;inset:20% 10% auto;z-index:20001;padding:30px}
      :root.opaque{--bb-frost-fill:100%;--bb-frost-row-fill:100%;--bb-frost-blur:none}
      @media(max-width:768px){.cards{grid-template-columns:1fr}}
      </style></head><body><button class="probe">Open dialog</button><main class="main-content">
      <h1>Model insights</h1><div class="cards">${Array.from({ length: 14 }, (_, i) => `<article class="mi-panel"><h2>Report ${i + 1}</h2><p>Verified historical results — readable model estimates and match statistics.</p><div class="chart"><i></i><i></i><i></i><i></i></div></article>`).join('')}</div>
      ${['matches','players','tournaments'].map(host => `<app-${host}><h2>${host}</h2><div class="table-wrapper"><section class="tournament-group"><table class="match-table"><thead><tr><th>Date</th><th>Matchup</th><th>Result</th></tr></thead><tbody>${Array.from({ length: 500 }, (_, i) => `<tr><td>20/08/2026</td><td>Player ${i} — Opponent</td><td>2:1</td></tr>`).join('')}</tbody></table></section></div><section class="bb-modal" hidden><h2>Match details</h2><button class="close">Close</button></section></app-${host}>`).join('')}
      </main><script>document.querySelector('.probe').onclick=()=>document.querySelector('.bb-modal').hidden=false;document.querySelector('.close').onclick=()=>document.querySelector('.bb-modal').hidden=true;</script></body></html>`;
    const server = http.createServer(async (request, response) => {
        const url = new URL(request.url, 'http://127.0.0.1');
        if (request.method !== 'GET') return response.writeHead(405).end();
        if (url.pathname === '/') { response.setHeader('Content-Type','text/html');return response.end(html); }
        if (url.pathname === '/styles.css') { response.setHeader('Content-Type','text/css');return response.end(css); }
        const asset=url.pathname.match(/^\/assets\/backgrounds\/(tennis-stadium-(?:dark|light|wimbledon|roland-garros|us-open)-v2\.webp)$/);
        if (asset) { response.setHeader('Content-Type','image/webp');return response.end(await fs.readFile(path.join(project,'src/assets/backgrounds',asset[1]))); }
        response.writeHead(404).end();
    });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const checks=[], perf=[];
    try {
        for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
            const context=await browser.newContext({viewport});
            await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
            const page=await context.newPage(); await page.goto(origin,{waitUntil:'networkidle'});
            for(const theme of ['dark','light','wimbledon','roland-garros','us-open']) {
                await page.evaluate(async theme=>{document.documentElement.dataset.bbTheme=theme;scrollTo(0,0);const src=getComputedStyle(document.body,'::before').backgroundImage.match(/url\(["']?([^"')]+)/)[1];const image=new Image();image.src=src;await image.decode();},theme);
                const styles=await page.evaluate(()=>{
                    const s=q=>getComputedStyle(document.querySelector(q));
                    return {card:s('.mi-panel').backgroundColor,blur:s('.mi-panel').backdropFilter,gridBlur:s('.table-wrapper').backdropFilter,
                        rowBlur:s('tbody tr').backdropFilter,cellBlur:s('td').backdropFilter,head:s('th').backgroundColor,dialog:s('.bb-modal').backgroundColor,
                        opacity:s('.mi-panel').opacity,filter:s('.mi-panel').filter,overflow:document.documentElement.scrollWidth>innerWidth};
                });
                assert.equal(styles.rowBlur,'none');assert.equal(styles.cellBlur,'none');assert.equal(styles.opacity,'1');assert.equal(styles.filter,'none');assert.equal(styles.overflow,false);
                assert.equal(styles.blur,viewport.width>768?'blur(2px)':'none'); assert.equal(styles.gridBlur,styles.blur);
                assert.ok(!styles.head.includes('/')&&!styles.head.startsWith('rgba'));assert.ok(!styles.dialog.includes('/')&&!styles.dialog.startsWith('rgba'));
                await page.screenshot({path:path.join(output,`cards-${theme}-${viewport.width}.png`)});
                await page.locator('app-matches').scrollIntoViewIfNeeded();
                await page.screenshot({path:path.join(output,`grid-${theme}-${viewport.width}.png`)});
                checks.push({theme,width:viewport.width,...styles});
            }
            await page.locator('.probe').click();await page.locator('.bb-modal:not([hidden]) .close').click();
            assert.equal(await page.locator('.bb-modal:not([hidden])').count(),0);
            for(const preference of [{contrast:'more'},{reducedMotion:'reduce'}]) {
                await page.emulateMedia(preference);
                const blur=await page.locator('.mi-panel').first().evaluate(el=>getComputedStyle(el).backdropFilter);
                assert.equal(blur,'none');
            }
            await page.emulateMedia({contrast:'no-preference',reducedMotion:'no-preference'});
            const session=await context.newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:4});
            for(const target of ['page','grid']) for(const opaque of [true,false]) {
                const measured=await page.evaluate(async({target,opaque})=>{
                    document.documentElement.classList.toggle('opaque',opaque);document.documentElement.dataset.bbTheme='dark';
                    const grid=document.querySelector('.table-wrapper');
                    if(target==='grid'){grid.scrollIntoView({block:'center'});grid.scrollTop=0;}else scrollTo(0,0);
                    await new Promise(resolve=>setTimeout(resolve,150));
                    const gaps=[];let previous;await new Promise(resolve=>{let i=0;const step=now=>{
                        if(previous!==undefined)gaps.push(now-previous);previous=now;
                        if(target==='grid')grid.scrollTop+=16;else scrollBy(0,16);
                        if(++i<100)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);});
                    const sorted=gaps.slice(5).sort((a,b)=>a-b);
                    return {p95FrameMs:sorted[Math.floor(sorted.length*.95)],maxFrameMs:Math.max(...sorted)};
                },{target,opaque});
                perf.push({width:viewport.width,target,opaque,cpuThrottle:4,...measured});
            }
            await context.close();
        }
        const report={passed:true,checks,perf,modalRemainsClickable:true,liveApisUsed:false};
        for(const sample of perf.filter(x=>!x.opaque)){
            const baseline=perf.find(x=>x.opaque&&x.width===sample.width&&x.target===sample.target);
            assert.ok(sample.p95FrameMs<=Math.max(50,baseline.p95FrameMs*1.5+10),'Review scrolling regression: '+JSON.stringify({sample,baseline}));
        }
        await fs.writeFile(path.join(output,'complete.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
    }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
