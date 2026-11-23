import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBetaProxy } from '../server/beta-proxy.mjs';
import { validModelDisplay } from '../server/model-display-feed.mjs';

const day='20261123', schema='bonzobyte.date-model-display-grid.v1', pathname='/api/model-display/'+day;
const packet={schema,day,rows:[[32,1,11,12,21,.6,.4]],held:[[33,2,13,14,21]]};
const publicOrigin='https://bonzobyte.com', upstream='https://raw.githubusercontent.com/BonzoByte/BonzoByte-Frontend/rally-model-display-data/model-display/';
const proxy=(fetcher,mode='public')=>createBetaProxy({settings:{APP_STAGE:'beta',BETA_PUBLIC_ORIGIN:publicOrigin,
    BETA_BACKEND_ORIGIN:'https://example.invalid',SITE_ACCESS_MODE:mode},fetcher,
    next:()=>new Response(null,{status:204}),rewrite:url=>new Response(url.href)});

test('returns the checked date-only packet without reading a match schedule or forwarding credentials',async()=>{
    const urls=[];
    const read=proxy((url,options)=>{
        urls.push(url);assert.equal(options.headers,undefined);assert.equal(options.redirect,'error');
        return Response.json(url.endsWith('index.json')?{schema,days:[day]}:packet);
    });
    const r=await read(new Request(publicOrigin+pathname+'?from=anything',{headers:{authorization:'ignored',cookie:'not-forwarded'}}));
    assert.equal(r.status,200);assert.deepEqual(await r.json(),packet);
    const index=await read(new Request(publicOrigin+'/api/model-display/index'));
    assert.deepEqual(await index.json(),{schema,days:[day]});
    assert.deepEqual(urls,[upstream+day+'.json',upstream+'index.json']);
    assert.match(r.headers.get('cache-control'),/no-store/);
});

test('rejects writes, duplicate or extra data, invalid dates and unauthenticated invited requests',async()=>{
    const offline=()=>{throw Error('Unexpected upstream');};
    assert.equal((await proxy(offline,'invited')(new Request(publicOrigin+pathname))).status,401);
    assert.equal((await proxy(offline)(new Request(publicOrigin+pathname,{method:'POST',headers:{origin:publicOrigin}}))).status,405);
    assert.equal((await proxy(offline)(new Request(publicOrigin+'/api/model-display/20261131'))).status,404);
    assert.equal((await proxy(()=>Response.json({...packet,scheduledStartUtc:'unrelated'}))(new Request(publicOrigin+pathname))).status,502);
    assert.equal(validModelDisplay({...packet,held:[packet.rows[0].slice(0,5)]},day),false);
    assert.equal(validModelDisplay({...packet,rows:[[32,1,11,12,21,.9,.2]]},day),false);
    assert.equal(validModelDisplay({schema,days:[day,day]},'index'),false);
});
