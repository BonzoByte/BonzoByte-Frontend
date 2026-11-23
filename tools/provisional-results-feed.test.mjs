import assert from 'node:assert/strict';
import test from 'node:test';
import {serveProvisionalResults, validProvisionalResults} from '../server/provisional-results-feed.mjs';

const day='20261123', now=Date.parse('2026-11-23T15:00:00Z'), path='/api/provisional-results/'+day;
const good={schema:'bonzobyte.provisional-results.v1',day,observedAt:'2026-11-23T14:01:00.000Z',
    rows:[[101,202,1,2,3,'2:1','7:6(5) 2:6 6:3']]};

test('validates identity, ordinary completed sets, freshness, and packet scope',()=>{
    assert.equal(validProvisionalResults(good,day,now),true);
    assert.equal(validProvisionalResults(good,day,now+20*3600000),false);
    assert.equal(validProvisionalResults({...good,observedAt:'2026-11-23T16:01:00.000Z'},day,now),false);
    assert.equal(validProvisionalResults({...good,isFinished:true},day,now),false);
    const row=good.rows[0], changes={1:0,3:1,5:'3:0',6:'7:6(5) 2:6 3:3'};
    for(const [i,value] of Object.entries(changes)){
        const altered=row.slice();altered[i]=value;
        assert.equal(validProvisionalResults({...good,rows:[altered]},day,now),false);
    }
    assert.equal(validProvisionalResults({...good,rows:[row,row]},day,now),false);
});

test('separate, read-only, bounded endpoint never returns unpublished garbage',async()=>{
    const headers={'Cache-Control':'no-store'};
    const send=(method,fetcher,stamp=day)=>serveProvisionalResults({
        day:stamp,now,fetcher,headers,request:new Request('https://bonzobyte.com'+path,{method})});
    const ok=await send('GET',async url=>{
        assert.match(url,/rally-provisional-results-data\/results\/20261123\.json$/);
        return Response.json(good);
    });
    assert.equal(ok.status,200);
    assert.deepEqual(await ok.json(),good);
    assert.equal(ok.headers.get('cache-control'),'no-store');
    const notCalled=()=>assert.fail('must not fetch');
    assert.equal((await send('POST',notCalled)).status,405);
    assert.equal((await send('GET',notCalled,'20261120')).status,404);
    assert.equal((await send('GET',async()=>new Response('x'.repeat(99000)))).status,502);
    assert.equal((await send('GET',async()=>Response.json({...good,rows:[['bad']]}))).status,404);
    assert.equal((await send('GET',async()=>new Response(null,{status:404}))).status,404);
});
