import test from 'node:test';
import assert from 'node:assert/strict';
import {serveFixtures} from '../server/announced-fixtures-feed.mjs';
const now=Date.parse('2026-11-26T08:30:00Z'), day='2026-11-27';
const example={schema:'bonzobyte.public-fixtures.v1',day,zone:'Europe/Zagreb',observedAt:'2026-11-26T08:00:00Z',
    matches:[{id:8,names:['One','Two'],start:'2026-11-26T23:30:00Z'},{id:9,names:['Three','Four'],start:null}]};
const send=(body,options={})=>serveFixtures({day,now,request:new Request('https://example.com',{headers:{cookie:'private-cookie'}}),
    headers:{},fetcher:(url,init)=>{assert.match(url,/rally-match-schedule-data\/fixtures\/[01]\.json$/);assert.equal(init.headers,undefined);return Response.json(body)},...options});
test('public list uses Zagreb calendar day, preserves unknown times and strips non-schedule fields',async()=>{
    const r=await send({...example,matches:example.matches.map(x=>({...x,odds:3,grade:'win'}))});
    assert.equal(r.status,200);assert.deepEqual((await r.json()).matches,example.matches);
});
test('wrong day in rotating slot never appears as a real empty day',async()=>{
    assert.equal((await send({...example,day:'2026-11-25'})).status,404);
    assert.equal((await send({...example,matches:[]})).status,200);
});
test('old observations, duplicates, broken data and unavailable upstream fail closed',async()=>{
    for(const bad of [{...example,observedAt:'2025-01-01T12:00:00Z'},{...example,matches:[example.matches[0],example.matches[0]]},
                      {...example,matches:[{...example.matches[0],names:['<html>','ok']}]}])assert.equal((await send(bad)).status,502);
    assert.equal((await send(example,{fetcher:()=>{throw Error()}})).status,502);
});
test('out-of-window and write methods never hit the data source; HEAD has no body',async()=>{
    const fetcher=()=>{throw Error('must not run')};
    assert.equal((await send(example,{fetcher,day:'2026-11-30'})).status,404);
    assert.equal((await send(example,{fetcher,request:new Request('https://example.com',{method:'POST'})})).status,405);
    assert.equal(await (await send(example,{request:new Request('https://example.com',{method:'HEAD'})})).text(),'');
});
