// Public, display-only. Fixed origin and two rolling slots, no viewer credentials.
const base='https://raw.githubusercontent.com/BonzoByte/BonzoByte-Frontend/rally-match-schedule-data/fixtures/';
const zone='Europe/Zagreb', limit=256*1024;
const local=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
const offset=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const validTime=t=>typeof t==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?Z$/.test(t)&&Number.isFinite(Date.parse(t));
export const fixturesPath=/^\/api\/announced-fixtures\/(\d{4}-\d\d-\d\d)$/;
const id=x=>Number.isSafeInteger(x)&&x>0;
const label=x=>typeof x==='string'&&x.length<=160&&!/[<>\p{Cc}\p{Cf}]/u.test(x)?x:'';
const country=x=>[0,1].map((_,i)=>typeof x?.[i]==='string'&&new RegExp('^[A-Z]{'+(i+2)+'}$').test(x[i])?x[i]:'');
function grid(g,now){
    if(!id(g?.eventId)||!label(g.title)||!['ATP','WTA'].includes(g.tour)||!Array.isArray(g.players)||g.players.length!==2||
       !g.players.every(p=>id(p?.id))||g.players[0].id===g.players[1].id)return null;
    const f=g.forecast;
    return {eventId:g.eventId,title:g.title,tour:g.tour,round:label(g.round),levelId:id(g.levelId)?g.levelId:null,
        level:label(g.level),surfaceId:id(g.surfaceId)?g.surfaceId:null,surface:label(g.surface),country:country(g.country),
        players:g.players.map(p=>({id:p.id,country:country(p.country),rank:label(p.rank),seed:label(p.seed)})),
        ...(Number.isFinite(f?.p)&&f.p>0&&f.p<1&&Date.parse(f.at)<=now?
            {forecast:{p:f.p,at:new Date(f.at).toISOString()}}:g.insufficient===true?{insufficient:true}:{})};
}
export async function serveFixtures({request,day,fetcher,headers,now=Date.now()}){
    const send=(status,body)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{
        status,headers:{...headers,'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'}});
    const absent=()=>send(404,{code:'FIXTURES_NOT_AVAILABLE'}),bad=()=>send(502,{code:'FIXTURES_UNAVAILABLE'});
    if(!['GET','HEAD'].includes(request.method))return send(405,{code:'FIXTURES_READ_ONLY'});
    const today=local.format(now);
    if(day!==today&&day!==offset(today,1))return absent();
    const slot=Math.floor(Date.parse(day+'T00:00:00Z')/86400000)%2;
    try{
        const r=await fetcher(base+slot+'.json',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(4500)});
        if(r.status===404)return absent();
        if(!r.ok||!r.body||Number(r.headers.get('content-length'))>limit)return bad();
        const reader=r.body.getReader(),chunks=[];let total=0;
        for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;
            if(total>limit){await reader.cancel();return bad();}chunks.push(value);}
        const bytes=new Uint8Array(total);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length;}
        const p=JSON.parse(new TextDecoder().decode(bytes));
        if(p?.day!==day)return absent();
        if(p.schema!=='bonzobyte.public-fixtures.v1'||p.zone!==zone||!validTime(p.observedAt)||
           Date.parse(p.observedAt)>now+60000||![day,offset(day,-1)].includes(local.format(Date.parse(p.observedAt)))||
           !Array.isArray(p.matches)||p.matches.length>600)return bad();
        const ids=new Set();const matches=[];
        for(const row of p.matches){
            if(!Number.isSafeInteger(row?.id)||row.id<=0||ids.has(row.id)||!Array.isArray(row.names)||row.names.length!==2||
               !row.names.every(n=>typeof n==='string'&&n.trim()&&n.length<=160&&!/[<>\p{Cc}\p{Cf}]/u.test(n)))return bad();
            ids.add(row.id);
            const start=validTime(row.start)&&local.format(Date.parse(row.start))===day?row.start:null;
            const g=grid(row.grid,now);
            matches.push({id:row.id,names:row.names,start,...(g?{grid:g}:{})});
        }
        return send(200,{day,zone,observedAt:p.observedAt,matches});
    }catch{return bad();}
}
