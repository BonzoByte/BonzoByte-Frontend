import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const src = readFileSync(new URL('../src/app/core/helpers/linked-daily-row.ts',import.meta.url),'utf8');
const js = ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {linkedDailyRow} = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const day='2026-11-28', summary={matchId:1939557,matchTPId:827567879,tournamentEventTPId:248048,player1TPId:655521,player2TPId:649860};
const row={...summary,dateTime:day+'T18:00:00',issuedGridPick:{p1:0.41627398187994724}};
test('shares the exact issued row, also for a reversed archive or announced fixture',()=>{
    for(const m of [row,{...row,matchId:null},{...row,player1TPId:649860,player2TPId:655521,issuedGridPick:{p1:1-row.issuedGridPick.p1}}])
        assert.equal(linkedDailyRow(summary,[m],day),m);
});
test('never assigns a prediction from a similar fixture or an ambiguous match',()=>{
    for(const rows of [[],[row,row],...[{player1TPId:2},{matchId:1},{matchTPId:4},{tournamentEventTPId:5},{dateTime:'2026-11-27'}].map(change=>[{...row,...change}])])
        assert.equal(linkedDailyRow(summary,rows,day),null);
});
test('a row without a forecast stays without one',()=>{
    const {issuedGridPick,...noForecast}=row;
    assert.equal(linkedDailyRow(summary,[noForecast],day),noForecast);
});
