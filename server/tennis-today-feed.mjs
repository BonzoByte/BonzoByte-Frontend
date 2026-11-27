import { serveFixtures } from './announced-fixtures-feed.mjs';
import { serveProvisionalResults } from './provisional-results-feed.mjs';
import { servePlannedSchedule } from './planned-schedule-feed.mjs';
import { renderToday, dayOf } from './tennis-today-page.mjs';

const final = /^(?:2:[01]|[01]:2|3:[012]|[012]:3)$/;
const rank = value => Number(value)>0 ? Number(value) : 10000;
const flip = s => s.replace(/(\d+):(\d+)/g,'$2:$1');
function align(a,b,x,y) {
  return a===x && b===y ? 1 : a===y && b===x ? -1 : 0;
}
async function packet(response) {
  if(response.status===404) return null;
  if(!response.ok) throw Error('Feed unavailable');
  return response.json();
}
async function archive(fetcher, backend, key) {
  // Fixed guest read only. Never forward request headers or viewer credentials.
  const r=await fetcher(backend+'/api/archives/daily/'+key,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(6000)});
  if(r.status===404) return null;
  const limit=5*1024*1024;
  if(!r.ok||!r.body||Number(r.headers.get('content-length'))>limit) throw Error('Daily grid unavailable');
  const reader=r.body.getReader(),decoder=new TextDecoder(),chunks=[];let n=0;
  for(;;){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>limit){await reader.cancel();throw Error('Oversized grid');}chunks.push(decoder.decode(value,{stream:true}));}
  const j=JSON.parse(chunks.join('')+decoder.decode());
  if(j.date!==key||!Array.isArray(j.matches)||j.count!==j.matches.length||j.count>2500) throw Error('Unexpected daily grid');
  return j;
}
export function dailyCards({a,f,r,s,day}) {
  const fixtures=new Map((f?.matches||[]).filter(m=>m.grid).map(m=>[m.id,m]));
  const scores=new Map((r?.rows||[]).map(row=>[row[0],row]));
  const slots=new Map((s?.slots||[]).map(row=>[row[0],row]));
  const rows=a?a.matches.map(m=>{
    const id=m.matchTPId, ids=[m.player1TPId,m.player2TPId], g=fixtures.get(id), eventId=m.tournamentEventTPId;
    const direction=g?.grid.eventId===eventId?align(...ids,...g.grid.players.map(p=>p.id)):0;
    const time=slots.get(id), slot=time&&align(...ids,time[1],time[2])?time[3]:null;
    const forecast=direction && g.grid.forecast ? {...g.grid.forecast,p:direction===1?g.grid.forecast.p:1-g.grid.forecast.p} : null;
    const score=m.isFinished && final.test(m.resultText)?m.resultText:'';
    const details=score && m.resultDetailsText?.startsWith(score+' ')?m.resultDetailsText.slice(score.length+1):'';
    return {id,matchId:m.matchId,names:[m.player1Name,m.player2Name],start:slot||(direction?g.start:null),
      grid:{eventId,title:m.tournamentEventName,tour:m.tournamentTypeName,round:m.roundName,
        players:ids.map((id,i)=>({id,rank:i?m.player2Rank:m.player1Rank})),forecast},
      score,sets:details,hasResultRow:!!(m.isFinished||m.result||m.resultDetails)};
  }):[...fixtures.values()];
  return rows.filter(m=>m.names.every(n=>typeof n==='string'&&n.trim())&&m.grid.title).map(m=>{
    const g=m.grid, ids=g.players.map(p=>p.id), row=scores.get(m.id);
    const direction=row && row[4]===g.eventId && (!a||row[1]===m.matchId)?align(...ids,row[2],row[3]):0;
    const hasResultRow=!!(m.hasResultRow || direction);
    const overlay=direction && !m.hasResultRow;
    const d=m.start?new Date(m.start):null;
    return {...m,score:overlay?(direction===1?row[5]:flip(row[5])):m.score||'',
      sets:overlay?(direction===1?row[6]:flip(row[6])):m.sets||'',hasResultRow,
      time:d&&Number.isFinite(+d)&&dayOf(d)===day?d:null,priority:rank(g.players[0].rank)+rank(g.players[1].rank)};
  });
}

export function createTennisToday() {
  // A small per-instance cache coalesces guest reads; never carry yesterday across midnight.
  let cache;
  return async function({request,backend,fetcher,headers,now=Date.now()}) {
    const day=dayOf(now), key=day.replaceAll('-',''), tag=backend+'|'+day;
    async function build() {
      const args={day,fetcher,headers:{},now,request:new Request('https://bonzobyte.com/')};
      const [a,f]=await Promise.all([archive(fetcher,backend,key),serveFixtures(args).then(packet).catch(()=>null)]);
      if(!a&&!f) throw Error('Waiting for the daily schedule');
      const [r,s]=await Promise.all([
        serveProvisionalResults({...args,day:key,request:new Request('https://bonzobyte.com/'+(a?'':'?roster=announced'))}).then(packet),
        a ? servePlannedSchedule({...args,day:key}).then(packet).catch(()=>null) : null
      ]);
      return renderToday(dailyCards({a,f,r,s,day}),r,new Date(now));
    }
    try {
      if(cache?.tag!==tag||now>=cache.until) cache={tag,until:now+60000,html:build()};
      const item=cache;
      let body;try{body=await item.html;}catch(e){if(cache===item)cache=null;throw e;}
      return new Response(request.method==='HEAD'?null:body,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'index, follow'}});
    } catch {
      return new Response(request.method==='HEAD'?null:'<!doctype html><html lang="en"><meta charset="utf-8"><title>Tennis today | BonzoByte</title><h1>Tennis today</h1><p>Today’s match data is temporarily unavailable. Please check back shortly or <a href="/matches">open the match grid</a>.</p></html>',{status:503,headers:{...headers,'Content-Type':'text/html; charset=utf-8','Retry-After':'60'}});
    }
  };
}
