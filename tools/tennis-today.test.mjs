import test from 'node:test';
import assert from 'node:assert/strict';
import {createTennisToday,dailyCards} from '../server/tennis-today-feed.mjs';
const day='2026-11-27', key='20261127', at=Date.parse(day+'T15:00:00Z');
const instant=n=>new Date(n).toISOString();
const m={id:20,names:['A','B'],start:instant(at+3600000),grid:{eventId:7,title:'Tournament',tour:'ATP',players:[{id:31,rank:'21'},{id:32,rank:'29'}],forecast:{p:.73,at:instant(at-10000)}}};
const f={day,schema:'bonzobyte.public-fixtures.v1',zone:'Europe/Zagreb',observedAt:instant(at-5000),matches:[m]};
const row=[20,null,32,31,7,'2:0','6:4 6:1'];
const archiveRow={matchTPId:20,matchId:444,player1TPId:32,player2TPId:31,player1Name:'B',player2Name:'A',tournamentEventTPId:7,tournamentEventName:'Tournament',tournamentTypeName:'ATP'};
test('align scores, sets and saved forecasts to the roster, reject wrong event or match',()=>{
 const cards=(a,rr)=>dailyCards({day,a,f,r:{rows:[rr]}});
 assert.equal(cards(null,row)[0].sets,'4:6 1:6');
 const a={matches:[archiveRow]}, rr=[20,444,32,31,7,'2:0','6:4 6:1'];
 assert.equal(cards(a,rr)[0].score,'2:0');assert.ok(Math.abs(cards(a,rr)[0].grid.forecast.p-.27)<1e-8);
 assert.equal(cards(a,[20,445,...rr.slice(2)])[0].score,'');
 assert.equal(cards(null,[20,null,32,31,8,...row.slice(5)])[0].score,'');
 assert.equal(cards({matches:[{...archiveRow,isFinished:true,resultText:'2:1',resultDetailsText:'2:1 6:4 2:6 6:1'}]},rr)[0].score,'2:1');
});
test('same URL progresses from a scheduled match to a final without redeploying, and resets at Zagreb midnight',async()=>{
 let hasScore=false;
 const fetcher=async url=>{
   if(url.includes('/fixtures/')) return Response.json(f);
   if(url.endsWith('announced-'+key+'.json')&&hasScore) return Response.json({day:key,schema:'bonzobyte.announced-results.v1',observedAt:instant(at),rows:[row]});
   return new Response(null,{status:404});
 };
 const serve=createTennisToday();
 const go=(now,method='GET')=>serve({now,request:new Request('https://bonzobyte.com/tennis-today',{method}),backend:'https://backend.invalid',fetcher,headers:{}});
 assert.match(await (await go(at)).text(),/Model favourite: <strong>A/);
 hasScore=true;const res=await go(at+61000);assert.equal(res.status,200);const html=await res.text();assert.match(html,/Final: 0–2/);assert.doesNotMatch(html,/Model favourite:/);
 assert.equal(await (await go(at+65000,'HEAD')).text(),'');
 assert.equal((await go(Date.parse(day+'T23:00:03Z'))).status,503);
});
