const base='https://raw.githubusercontent.com/BonzoByte/BonzoByte-Frontend/rally-match-schedule-data/schedules/';
const schema='bonzobyte.planned-match-schedule.v1';
const limit=64*1024;
export const schedulePath=/^\/api\/match-schedule\/(\d{8})$/;

// No browser cookies, authorization, query strings or destinations are forwarded.
export async function servePlannedSchedule({ request,day,fetcher,headers }) {
    const send=(status,body)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{
        status,headers:{...headers,'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'},
    });
    if(!['GET','HEAD'].includes(request.method)) return send(405,{code:'SCHEDULE_READ_ONLY'});
    const date=new Date(day.slice(0,4)+'-'+day.slice(4,6)+'-'+day.slice(6,8)+'T00:00:00Z');
    if(!Number.isFinite(+date)||date.toISOString().slice(0,10).replaceAll('-','')!==day)
        return send(404,{code:'SCHEDULE_NOT_FOUND'});
    try {
        const upstream=await fetcher(base+day+'.json',{method:'GET',redirect:'error',signal:AbortSignal.timeout(1600)});
        if(upstream.status===404) return send(404,{code:'SCHEDULE_NOT_FOUND'});
        if(!upstream.ok || !upstream.body || Number(upstream.headers.get('content-length'))>limit)
            return send(502,{code:'SCHEDULE_UNAVAILABLE'});
        const reader=upstream.body.getReader();
        const chunks=[];let length=0;
        for(;;){
            const {value,done}=await reader.read();
            if(done)break;
            length+=value.byteLength;
            if(length>limit){await reader.cancel();return send(502,{code:'SCHEDULE_UNAVAILABLE'});}
            chunks.push(value);
        }
        const bytes=new Uint8Array(length);
        let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
        const value=JSON.parse(new TextDecoder().decode(bytes));
        if(Object.keys(value).sort().join(',')!=='day,observedAt,schema,slots' ||
            value.schema!==schema || value.day!==day || typeof value.observedAt!=='string' ||
            !Array.isArray(value.slots) || !value.slots.length || value.slots.length>500 ||
            !value.slots.every(slot=>Array.isArray(slot) && slot.length===4 &&
                slot.slice(0,3).every(i=>Number.isSafeInteger(i)&&i>0) && typeof slot[3]==='string'))
            return send(502,{code:'SCHEDULE_UNAVAILABLE'});
        return send(200,value);
    } catch { return send(502,{code:'SCHEDULE_UNAVAILABLE'}); }
}
