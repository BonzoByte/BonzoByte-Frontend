import type { Match } from '../models/tennis.model';
import type { MatchDetailsRaw } from '../models/match-details.model';

/** Use the daily row as the identity for the normal details renderer. Never
 * manufacture archive-only statistics, market prices or neural-network inputs. */
export function dailyMatchDetails(m:Partial<Match>):MatchDetailsRaw|null {
    const a=m.player1TPId,b=m.player2TPId,e=m.tournamentEventTPId,id=m.matchTPId;
    if(!a||!b||a===b||!e||!id||![a,b,e,id].every(n=>Number.isSafeInteger(n)&&n>0)||
        !m.dateTime||!m.player1Name||!m.player2Name)return null;
    const player=(side:1|2)=>({p01:side===1?a:b,p02:(side===1?m.player1Name:m.player2Name)!,
        p03:(side===1?m.player1CountryTPId:m.player2CountryTPId)??0,p07:0,
        p04:(side===1?m.player1CountryISO3:m.player2CountryISO3)??'',
        p05:(side===1?m.player1CountryISO2:m.player2CountryISO2)??'',
        p06:(side===1?m.player1CountryFull:m.player2CountryFull)??''});
    return {m001:id,m003:m.dateTime,m004:a,m005:b,
        m006:Number(m.player1Rank)||undefined,m007:Number(m.player2Rank)||undefined,m008:m.player1Seed,m009:m.player2Seed,
        m010:m.result||'',m011:m.resultDetails||'',isFinished:m.isFinished===true,m656:m.isFinished===true,
        m019:m.surfaceId??0,m020:m.surface,m021:0,m022:m.roundName,p1:player(1),p2:player(2),
        t:{t01:e,t02:m.tournamentEventName??'',t03:m.tournamentEventCountryTPId??0,t04:m.tournamentEventCountryISO3??'',
            t05:m.tournamentEventCountryISO2??'',t06:m.tournamentEventCountryFull??'',t07:0,t08:'',t09:'',t10:0,t11:'',
            t12:0,t13:m.tournamentTypeName??'',t15:m.tournamentLevelId??0,t16:m.tournamentLevelName??''}};
}
