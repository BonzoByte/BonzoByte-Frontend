import type { Match } from '../models/tennis.model';

/** Use completed, scored days strictly before the fixture (same-day order is not reliable).
 * Scores below are always oriented to the player whose form is being shown. */
export function fixtureForm(rows: readonly Match[], player: number, before: string, fixture: number) {
    const seen=new Set<number>();
    return rows.flatMap(m=>{
        const date=m.dateTime?.slice(0,10), a=m.player1TPId===player, b=m.player2TPId===player;
        const score=/^([0-3]):?([0-3])$/.exec(String(m.result??'').trim());
        if(!m.isFinished||!date||date>=before||!score||a===b||m.matchTPId===fixture||seen.has(m.matchTPId))return [];
        const x=Number(score[a?1:2]),y=Number(score[a?2:1]);
        if(Math.max(x,y)<2||x===y)return [];
        seen.add(m.matchTPId);
        return [{match:m,id:m.matchTPId,date,opponent:a?m.player2Name:m.player1Name,opponentId:a?m.player2TPId:m.player1TPId,
            won:x>y,score:x+':'+y}];
    }).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
}
