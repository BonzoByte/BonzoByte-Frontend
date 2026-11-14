export interface FantasyPlayer { playerId:number; name:string; tour:'ATP'|'WTA'; countryISO2:string|null; countryISO3:string|null; price:number; strength:number; mu:number; sigma:number; recentMatches:number; }
export interface FantasySeason { month:string; start:string; end:string; status:'open'|'final'; catalogueSha:string; rewardsEnabled:boolean; sourceAsOf:string; catalogueCoverage?:string; }
export interface FantasyStatus { season:FantasySeason|null; months:string[]; serverTime:string; }
export interface FantasyTeam { id:string; name:string; revision:number; qualified:boolean; firstDay:string; currentPlayers:number[]; plannedPlayers:number[]; effectiveDay:string; usedTransfers:number; reservedTransfers:number; remainingTransfers:number; cost:number; cash:number; season:string; }
export interface FantasyResult { fixtureId:number; day:string; status:string; pointsMinor:number; entries:{playerId:number;probability:number;outcome:string;pointsMinor:number}[]; }
export interface FantasyMine { team:FantasyTeam|null; players:FantasyPlayer[]; pointsMinor:number; results:FantasyResult[]; resultCount:number; provisional:boolean; serverTime:string; }
export interface FantasyMarket { items:FantasyPlayer[]; total:number; page:number; pageSize:number; catalogueSha:string; }
export interface FantasyStanding { id:string; name:string; nickname:string; pointsMinor:number; rank:number; matches:number; qualified:boolean; }
export interface FantasyBoard { qualified:FantasyStanding[]; provisional:FantasyStanding[]; final:boolean; rewardsEnabled:boolean; }
export interface FantasyPublicTeam { id:string; name:string; nickname:string; players:FantasyPlayer[]; qualified:boolean; }
export const fantasyCost=(ids:number[],players:Map<number,FantasyPlayer>)=>ids.reduce((sum,id)=>sum+(players.get(id)?.price??0),0);
export const FANTASY_BUDGET=1000000;
export interface FantasyBudgetSummary { spent:number; remaining:number; emptySlots:number; minimumForEmptySlots:number; shortfall:number; usedPercent:number; }
export function fantasyBudgetSummary(ids:number[],players:Map<number,FantasyPlayer>):FantasyBudgetSummary {
  const spent=fantasyCost(ids,players),remaining=FANTASY_BUDGET-spent,emptySlots=Math.max(0,10-new Set(ids).size);
  // A lower bound from the fixed minimum price, not an automatic reservation or
  // a claim that a partially loaded market contains all affordable combinations.
  const minimumForEmptySlots=emptySlots*25000;
  return {spent,remaining,emptySlots,minimumForEmptySlots,shortfall:Math.max(0,minimumForEmptySlots-remaining),
    usedPercent:Math.max(0,Math.min(100,spent/FANTASY_BUDGET*100))};
}
export const fantasyChanged=(a:number[],b:number[])=>a.length!==b.length||a.some(id=>!b.includes(id));
export function fantasyDraftProblem(ids:number[],players:Map<number,FantasyPlayer>):string|null {
  if(ids.length!==10||new Set(ids).size!==10||ids.some(id=>!players.has(id)))return 'fantasy.squadRequired';
  if(ids.filter(id=>players.get(id)?.tour==='ATP').length!==5)return 'fantasy.tourBalance';
  if(fantasyCost(ids,players)>1000000)return 'fantasy.budgetExceeded';
  return null;
}
