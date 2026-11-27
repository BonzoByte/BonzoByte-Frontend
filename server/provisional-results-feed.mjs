const root='https://raw.githubusercontent.com/BonzoByte/BonzoByte-Frontend/rally-provisional-results-data/results/';
export const provisionalPath=/^\/api\/provisional-results\/(20\d{6})$/;
const schema='bonzobyte.provisional-results.v1';
const maxBytes=96*1024;
const id=n=>Number.isSafeInteger(n)&&n>0;
const zagreb=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zagreb',year:'numeric',month:'2-digit',day:'2-digit'});
const dayKey=t=>zagreb.format(t).split('/').reverse().join('');
function recentDay(day,now){
    const today=dayKey(now), noon=Date.parse(today.replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3')+'T12:00:00Z');
    return [0,1,2].some(back=>day===dayKey(noon-back*86400000));
}

export function validProvisionalResults(packet,day,now=Date.now(),announced=false){
    if(!packet || Object.keys(packet).sort().join(',')!=='day,observedAt,rows,schema' ||
       packet.schema!==(announced?'bonzobyte.announced-results.v1':schema) || packet.day!==day || !recentDay(day,now) ||
       typeof packet.observedAt!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(packet.observedAt) ||
       !Array.isArray(packet.rows) || packet.rows.length>600) return false;
    const observed=Date.parse(packet.observedAt);
    // The date of the match is not the date its final must first appear.
    if(!Number.isFinite(observed) || dayKey(observed)<day || observed>now)return false;
    const tp=new Set(), matches=new Set();
    return packet.rows.every(row=>{
        if(!Array.isArray(row)||row.length!==7||!row.slice(0,5).every((v,i)=>announced&&i===1?v===null:id(v))||row[2]===row[3]||
           tp.has(row[0])||(!announced&&matches.has(row[1]))||typeof row[5]!=='string'||! /^(?:2:[01]|[01]:2|3:[012]|[012]:3)$/.test(row[5]) ||
           typeof row[6]!=='string'||row[6].length>49)return false;
        const final=row[5].split(':').map(Number),sets=row[6].split(' '), wins=[0,0], target=Math.max(...final);
        if(sets.length!==final[0]+final[1])return false;
        for(const s of sets){
            const m=/^([0-7]):([0-7])(?:\((0|[1-9]\d?)\))?$/.exec(s);
            if(!m||wins.includes(target))return false;
            const a=+m[1],b=+m[2],hi=Math.max(a,b),lo=Math.min(a,b);
            if(!((hi===6&&lo<=4)||(hi===7&&(lo===5||lo===6))) || (m[3]!==undefined&&lo!==6))return false;
            wins[a>b?0:1]++;
        }
        if(wins[0]!==final[0]||wins[1]!==final[1])return false;
        tp.add(row[0]); matches.add(row[1]); return true;
    });
}

export async function serveProvisionalResults({request,day,fetcher,headers,now=Date.now()}){
    const send=(status,value)=>new Response(request.method==='HEAD'?null:JSON.stringify(value),{
        status,headers:{...headers,'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'},
    });
    if(!['GET','HEAD'].includes(request.method))return send(405,{code:'PROVISIONAL_RESULTS_READ_ONLY'});
    if(!recentDay(day,now))return send(404,{code:'PROVISIONAL_RESULTS_NOT_FOUND'});
    try{
        const announced=new URL(request.url).searchParams.get('roster')==='announced';
        const up=await fetcher(root+(announced?'announced-':'')+day+'.json',{redirect:'error',signal:AbortSignal.timeout(2600)});
        if(up.status===404)return send(404,{code:'PROVISIONAL_RESULTS_NOT_FOUND'});
        if(!up.ok||!up.body||Number(up.headers.get('content-length'))>maxBytes)return send(502,{code:'PROVISIONAL_RESULTS_UNAVAILABLE'});
        const reader=up.body.getReader(), decoder=new TextDecoder('utf-8',{fatal:true});
        let size=0,body='';
        for(;;){
            const {value,done}=await reader.read(); if(done)break;
            size+=value.byteLength;
            if(size>maxBytes){await reader.cancel();return send(502,{code:'PROVISIONAL_RESULTS_UNAVAILABLE'});}
            body+=decoder.decode(value,{stream:true});
        }
        const packet=JSON.parse(body+decoder.decode());
        return validProvisionalResults(packet,day,now,announced) ? send(200,packet) : send(404,{code:'PROVISIONAL_RESULTS_NOT_FOUND'});
    }catch{return send(502,{code:'PROVISIONAL_RESULTS_UNAVAILABLE'});}
}
