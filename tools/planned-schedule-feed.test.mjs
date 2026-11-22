import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBetaProxy } from '../server/beta-proxy.mjs';
const route='https://bonzobyte.com/api/match-schedule/20261121';
const target='https://raw.githubusercontent.com/BonzoByte/BonzoByte-Frontend/rally-match-schedule-data/schedules/20261121.json';
const payload={schema:'bonzobyte.planned-match-schedule.v1',day:'20261121',observedAt:'2026-11-21T17:00:00.000Z',slots:[[10,11,12,'2026-11-21T18:00:00.000Z']]};
const proxy=(fetcher,other={})=>createBetaProxy({settings:{APP_STAGE:'beta',BETA_PUBLIC_ORIGIN:'https://bonzobyte.com',
    BETA_BACKEND_ORIGIN:'https://example.invalid',SITE_ACCESS_MODE:'public',...other},fetcher,
    next:()=>new Response(null,{status:204}),rewrite:url=>new Response(url.href)});
test('serves dedicated JSON without forwarding client authorization, cookies, or query',async()=>{
    const read=proxy((url,options)=>{
        assert.equal(url,target);
        assert.equal(options.headers,undefined);
        assert.equal(options.redirect,'error');
        return Response.json(payload);
    });
    const r=await read(new Request(route+'?url=https://example.invalid',{headers:{authorization:'redacted',cookie:'private=yes'}}));
    assert.equal(r.status,200);
    assert.deepEqual(await r.json(),payload);
    assert.match(r.headers.get('cache-control'),/no-store/);
    assert.equal(await (await read(new Request(route,{method:'HEAD'}))).text(),'');
    assert.equal(await (await read(new Request('https://bonzobyte.com/api/archives/daily/20261121'))).text(),'https://example.invalid/api/archives/daily/20261121');
});
test('blocks writes, private mode bypass, and malformed or oversized feeds',async()=>{
    const noNetwork=()=>{throw Error('No request expected');};
    assert.equal((await proxy(noNetwork)(new Request(route,{method:'POST',headers:{origin:'https://bonzobyte.com'}}))).status,405);
    assert.equal((await proxy(noNetwork,{SITE_ACCESS_MODE:'invited'})(new Request(route))).status,401);
    assert.equal((await proxy(noNetwork)(new Request(route.replace('20261121','20261131')))).status,404);
    assert.equal((await proxy(()=>new Response(null,{status:404}))(new Request(route))).status,404);
    assert.equal((await proxy(()=>new Response(' '.repeat(65537)))(new Request(route))).status,502);
    assert.equal((await proxy(()=>Response.json({...payload,extra:'private'}))(new Request(route))).status,502);
});
