import type { Match } from '../models/tennis.model';

/** Wire row: TP id, match id, original player ids, event, original P1, issue/publication/start ms, archived winner. */
export function applyIssuedGridPicks(matches:Match[],input:unknown,day:string,now=Date.now()):Match[]{
    const packet=input as {schema?:string; day?:string; rows?:unknown[]}|null;
    if(!packet||packet.schema!=='bonzobyte.issued-forecast-grades.v1'||packet.day!==day||
       !Array.isArray(packet.rows)||packet.rows.length>2500)return matches;
    const rows=new Map<number,number[]>(), ids=new Set<number>();
    for(const r of packet.rows){
        if(!Array.isArray(r)||r.length!==10||!r.slice(0,5).every(n=>Number.isSafeInteger(n)&&n>0)||
           r[2]===r[3]||rows.has(r[0])||ids.has(r[1])||!(typeof r[5]==='number'&&r[5]>0&&r[5]<1&&r[5]!==0.5)||
           !r.slice(6,9).every(n=>Number.isSafeInteger(n)&&n>0)||!(r[6]<=r[7]&&r[7]<r[8]&&r[7]<=now)||
           !(r[9]===null||r[9]===r[2]||r[9]===r[3]))return matches;
        rows.set(r[0],r);ids.add(r[1]);
    }
    const seen=new Set<number>(),dup=new Set<number>();
    for(const m of matches){if(seen.has(m.matchTPId))dup.add(m.matchTPId);seen.add(m.matchTPId);}
    return matches.map(m=>{
        const r=rows.get(m.matchTPId);
        if(!r||dup.has(m.matchTPId)||m.matchId!==r[1]||m.tournamentEventTPId!==r[4]||
            m.dateTime?.slice(0,10).replace(/-/g,'')!==day)return m;
        const exact=m.player1TPId===r[2]&&m.player2TPId===r[3],reverse=m.player1TPId===r[3]&&m.player2TPId===r[2];
        if(!exact&&!reverse)return m;
        return {...m,issuedGridPick:{p1:exact?r[5]:1-r[5],archivedWinner:r[9]}};
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
