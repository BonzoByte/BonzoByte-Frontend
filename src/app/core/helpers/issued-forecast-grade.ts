import type { Match } from '../models/tennis.model';

/** V2 records the time of the scoreless observation, not an assumed start, and identifies the public feed. */
export function applyIssuedGridPicks(matches:Match[],input:unknown,day:string,now=Date.now()):Match[]{
    const packet=input as {schema?:string; day?:string; rows?:unknown[]}|null;
    const v2=packet?.schema==='bonzobyte.issued-forecast-grades.v2';
    if(!packet||(!v2&&packet.schema!=='bonzobyte.issued-forecast-grades.v1')||packet.day!==day||
       !Array.isArray(packet.rows)||packet.rows.length>2500)return matches;
    type Wire=[number,number,number,number,number,number,number,number,number,number|null,string?,[string,string]?];
    const rows=new Map<number,Wire>(), ids=new Set<number>();
    for(const r of packet.rows){
        if(!Array.isArray(r)||r.length!==(v2?12:10)||!r.slice(0,5).every(n=>Number.isSafeInteger(n)&&n>0)||
           r[2]===r[3]||rows.has(r[0])||ids.has(r[1])||!(typeof r[5]==='number'&&r[5]>0&&r[5]<1&&r[5]!==0.5)||
           !r.slice(6,9).every(n=>Number.isSafeInteger(n)&&n>0)||!(r[6]<=r[7]&&r[7]<=now)||
           (v2?(!['display','issued'].includes(r[10])||r[8]>now||(r[10]==='issued'&&r[8]>r[6])):r[7]>=r[8])||
           (v2&&r[11]!==null&&!(Array.isArray(r[11])&&r[11].length===2&&/^(?:2:[01]|[01]:2|3:[012]|[012]:3)$/.test(r[11][0])&&
                /^[0-7]:[0-7](?:\(\d{1,2}\))?(?: [0-7]:[0-7](?:\(\d{1,2}\))?){1,4}$/.test(r[11][1])))||
           !(r[9]===null||r[9]===r[2]||r[9]===r[3]))return matches;
        rows.set(r[0],r as Wire);ids.add(r[1]);
    }
    const seen=new Set<number>(),dup=new Set<number>();
    for(const m of matches){if(seen.has(m.matchTPId))dup.add(m.matchTPId);seen.add(m.matchTPId);}
    return matches.map(m=>{
        const r=rows.get(m.matchTPId);
        if(!r||dup.has(m.matchTPId)||m.matchId!==r[1]||m.tournamentEventTPId!==r[4]||
            m.dateTime?.slice(0,10).replace(/-/g,'')!==day)return m;
        const exact=m.player1TPId===r[2]&&m.player2TPId===r[3],reverse=m.player1TPId===r[3]&&m.player2TPId===r[2];
        if(!exact&&!reverse)return m;
        const orient=(s:string)=>exact?s:s.replace(/(\d):(\d)/g,'$2:$1');
        const publicFinal=r[11]?{result:orient(r[11][0]),sets:orient(r[11][1])}:undefined;
        return {...m,issuedGridPick:{p1:exact?r[5]:1-r[5],archivedWinner:r[9],publicFinal}};
    });
}
export function issuedGridGrade(m:Match,fastResult?:string){
    const pick=m.issuedGridPick;
    const state:{forecast:boolean;pending:boolean;outcome:'correct'|'incorrect'|null}={forecast:!!pick,pending:false,outcome:null};
    if(!pick)return state;
    const pending=m.isFinished===false&&!m.result&&!m.resultDetails&&(!m.qualityStatus||m.qualityStatus==='NotAssessed');
    const raw=pending?fastResult:m.isFinished===true&&m.calculationEligible===true?m.result:null;
    const s=String(raw??'').trim().replace(/[:\s-]/g,'');
    if(!/^(20|21|30|31|32|02|12|03|13|23)$/.test(s)){state.pending=pending&&!fastResult;return state;}
    const winner=s[0]>s[1]?m.player1TPId:m.player2TPId;
    if(pick.archivedWinner!=null&&pick.archivedWinner!==winner)return state;
    state.outcome=winner===(pick.p1>.5?m.player1TPId:m.player2TPId)?'correct':'incorrect';
    return state;
}
