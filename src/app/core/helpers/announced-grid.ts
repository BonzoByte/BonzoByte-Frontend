import { Match } from '../models/tennis.model';
type Side={id:number;country:string[];rank:string;seed:string};
interface Grid{eventId:number;title:string;tour:'ATP'|'WTA';round:string;levelId:number|null;level:string;
    surfaceId:number|null;surface:string;country:string[];players:[Side,Side];forecast?:{p:number;at:string};insufficient?:boolean}
export interface AnnouncedFixtures {day:string;matches:{id:number;names:string[];start:string|null;grid?:Grid}[]}
/** Adapt only at the input boundary: all filters, layouts, sorting and row components stay shared. */
export function announcedMatches(packet:AnnouncedFixtures,day:string):Match[]{
    if(packet?.day!==day||!Array.isArray(packet.matches))throw Error('Unexpected schedule date');
    return packet.matches.map(({id,names,start,grid:g})=>{
        if(!g)throw Error('Incomplete tournament metadata');
        const [a,b]=g.players, f=g.forecast;
        return {matchTPId:id,matchId:null,dateTime:day+'T00:00:00',sourceTimePrecision:'date',plannedStartUtc:start,
            plannedStartChecked:true,plannedStartKind:start?'not-before':null,isFinished:false,roundName:g.round,
            tournamentEventTPId:g.eventId,tournamentEventName:g.title,tournamentTypeId:g.tour==='ATP'?2:4,
            tournamentTypeName:g.tour,tournamentLevelId:g.levelId??undefined,tournamentLevelName:g.level,
            tournamentEventCountryTPId:0,tournamentEventCountryISO2:g.country[0],tournamentEventCountryISO3:g.country[1],
            tournamentEventCountryFull:'',surfaceId:g.surfaceId??undefined,surface:g.surface,
            player1TPId:a.id,player1Name:names[0],player1CountryISO2:a.country[0],player1CountryISO3:a.country[1],
            player1CountryTPId:0,player1CountryFull:'',player1Rank:a.rank,player1Seed:a.seed,
            player2TPId:b.id,player2Name:names[1],player2CountryISO2:b.country[0],player2CountryISO3:b.country[1],
            player2CountryTPId:0,player2CountryFull:'',player2Rank:b.rank,player2Seed:b.seed,dateModelInsufficientHistory:g.insufficient,
            ...(f?{publicForecastIssuedAtUtc:f.at,modelProbabilityPlayer1:f.p*100,modelProbabilityPlayer2:(1-f.p)*100,
                predictionEligible:true,...(f.p!==0.5?{issuedGridPick:{p1:f.p,archivedWinner:null}}:{})}:{})};
    });
}
