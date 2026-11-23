const root='https://raw.githubusercontent.com/BonzoByte/BonzoByte-Frontend/rally-model-display-data/model-display/';
const schema='bonzobyte.date-model-display-grid.v1';
const limit=225*1024;
export const modelDisplayPath=/^\/api\/model-display\/(index|20\d{6})$/;

const validDay=day=>{
    if(typeof day!=='string'||!/^20\d{6}$/.test(day))return false;
    const d=new Date(day.slice(0,4)+'-'+day.slice(4,6)+'-'+day.slice(6)+'T00:00:00Z');
    return Number.isFinite(+d)&&d.toISOString().slice(0,10).replaceAll('-','')===day;
};
const noExtra=(value,keys)=>value&&Object.keys(value).sort().join(',')===keys;
const id=n=>Number.isSafeInteger(n)&&n>0;
const prob=n=>typeof n==='number'&&n>0&&n<1;

export function validModelDisplay(value,key){
    if(value?.schema!==schema)return false;
    if(key==='index'){
        return noExtra(value,'days,schema')&&Array.isArray(value.days)&&value.days.length<=15000&&
            value.days.every((day,i)=>validDay(day)&&(!i||value.days[i-1]<day));
    }
    if(!validDay(key)||!noExtra(value,'day,held,rows,schema')||value.day!==key||
        !Array.isArray(value.rows)||!Array.isArray(value.held)||value.rows.length+value.held.length>2500)return false;
    const matchIds=new Set(), publicIds=new Set();
    const check=(row,count)=>{
        if(!Array.isArray(row)||row.length!==count||!row.slice(0,5).every(id)||row[2]===row[3]||
            publicIds.has(row[0])||matchIds.has(row[1]))return false;
        publicIds.add(row[0]);matchIds.add(row[1]);return true;
    };
    return value.rows.every(row=>check(row,7)&&prob(row[5])&&prob(row[6])&&Math.abs(row[5]+row[6]-1)<1e-10)&&
        value.held.every(row=>check(row,5));
}

export async function serveModelDisplay({request,key,fetcher,headers}){
    const send=(status,value)=>new Response(request.method==='HEAD'?null:JSON.stringify(value),{
        status,headers:{...headers,'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'},
    });
    if(!['GET','HEAD'].includes(request.method))return send(405,{code:'MODEL_DISPLAY_READ_ONLY'});
    if(key!=='index'&&!validDay(key))return send(404,{code:'MODEL_DISPLAY_NOT_FOUND'});
    try{
        const up=await fetcher(root+key+'.json',{method:'GET',redirect:'error',signal:AbortSignal.timeout(1600)});
        if(up.status===404)return send(404,{code:'MODEL_DISPLAY_NOT_FOUND'});
        if(!up.ok||!up.body||Number(up.headers.get('content-length'))>limit)return send(502,{code:'MODEL_DISPLAY_UNAVAILABLE'});
        const reader=up.body.getReader(), chunks=[];
        let size=0;
        for(;;){
            const {value,done}=await reader.read();if(done)break;
            size+=value.byteLength;
            if(size>limit){await reader.cancel();return send(502,{code:'MODEL_DISPLAY_UNAVAILABLE'});}
            chunks.push(value);
        }
        const data=new Uint8Array(size);
        let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
        const value=JSON.parse(new TextDecoder().decode(data));
        if(!validModelDisplay(value,key))return send(502,{code:'MODEL_DISPLAY_UNAVAILABLE'});
        return send(200,value);
    }catch{return send(502,{code:'MODEL_DISPLAY_UNAVAILABLE'});}
}
