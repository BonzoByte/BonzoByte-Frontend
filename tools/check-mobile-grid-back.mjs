// Read-only guest regression. Pass a TP id from today's grid plus an optional candidate build directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium,devices}=createRequire(import.meta.url)(process.env.BB_PLAYWRIGHT || 'playwright-core');
const [id,dist]=process.argv.slice(2), origin='https://bonzobyte.com';
assert.match(id ?? '',/^[1-9]\d*$/);
const browser=await chromium.launch({executablePath:process.env.BB_BROWSER || undefined});
try {
    for (const [width,closeViaX] of [[412,false],[360,true]]) {
        const context=await browser.newContext({...devices['Pixel 7'],viewport:{width,height:839},
            locale:'en-GB',timezoneId:'Europe/Zagreb',serviceWorkers:'block'});
        const page=await context.newPage(), errors=[];
        page.on('pageerror',err=>errors.push(err.message));
        if(dist) await page.route(origin+'/**',route=>{
            const u=new URL(route.request().url());
            if(route.request().method()==='GET' && !u.pathname.startsWith('/api/')){
                const file=path.resolve(dist,'.'+(u.pathname==='/matches'?'/index.html':decodeURIComponent(u.pathname)));
                if(file.startsWith(path.resolve(dist)+path.sep) && fs.statSync(file,{throwIfNoEntry:false})?.isFile())
                    return route.fulfill({path:file});
            }
            return route.continue();
        });
        await page.goto(origin+'/tennis-today',{waitUntil:'domcontentloaded'});
        await page.getByRole('link',{name:/full match grid/i}).first().tap();
        const row=page.locator('tr[data-match-id="'+id+'"]:visible').first(), button=row.locator('.details-icon-btn');
        await button.waitFor({timeout:55000});
        const reject=page.getByRole('button',{name:'Reject all optional',exact:true});
        await reject.tap();await reject.waitFor({state:'hidden'});
        const position=()=>row.evaluate(el=>{
            const rect=el.getBoundingClientRect();
            const offsets=[];for(let n=el;n;n=n.parentElement) if(n.scrollLeft||n.scrollTop) offsets.push([n.scrollLeft,n.scrollTop]);
            return {top:Math.round(rect.top),left:Math.round(rect.left),offsets};
        });
        await button.scrollIntoViewIfNeeded();
        const start=await position(), baseUrl=page.url(), target=await button.boundingBox();
        assert.ok(target.width>=44 && target.height>=44,JSON.stringify(target));
        const gridNode=await row.elementHandle();
        await button.tap({position:{x:4,y:4}}); // Outside the visible 16px icon.
        const modal=page.locator('.bb-modal--match-details');
        await modal.locator('.bb-players-2col').first().waitFor();
        for (const name of ['TS Breakdown','WP Breakdown']) {
            await modal.getByRole('button',{name,exact:true}).tap();
            await modal.locator('.bb-chart-wrap svg path[d]').first().waitFor();
        }
        await page.goBack(); await modal.waitFor({state:'hidden'});
        assert.equal(page.url(),baseUrl);
        assert.equal(await gridNode.evaluate(e=>e.isConnected),true);
        assert.deepEqual(await position(),start);
        if(closeViaX) {
            await page.goForward(); await modal.locator('.bb-panel').first().waitFor();
            await modal.locator('.close-button').tap();
            await page.waitForURL(baseUrl);await modal.waitFor({state:'hidden'});
            assert.deepEqual(await position(),start);
        }
        await page.goBack();await page.waitForURL(origin+'/tennis-today');
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({width,hit:[target.width,target.height],charts:'TS + WP',backToSameRow:id,position:start,
            nextBack:'/tennis-today',forwardAndCloseChecked:closeViaX}));
        await context.close();
    }
} finally { await browser.close(); }
