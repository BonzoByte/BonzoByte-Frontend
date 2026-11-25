import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {validForecastGrades} from '../server/model-display-feed.mjs';
const js=ts.transpileModule(readFileSync(new URL('../src/app/core/helpers/issued-forecast-grade.ts',import.meta.url),'utf8'),
    {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {applyIssuedGridPicks,issuedGridGrade}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const base={matchTPId:11,matchId:21,player1TPId:1,player2TPId:2,tournamentEventTPId:5,dateTime:'2026-11-25T11:00',isFinished:false,qualityStatus:'NotAssessed'};
const row=[11,21,1,2,5,.85,100,200,300,null],key='20261125',packet={schema:'bonzobyte.issued-forecast-grades.v1',day:key,rows:[row]};
const match=(m,p=packet)=>applyIssuedGridPicks([m],p,key)[0];
test('live final changes pending to win/miss, not the underlying row',()=>{
    assert.ok(validForecastGrades(packet,key));const m=match(base);
    assert.equal(issuedGridGrade(m).pending,true);assert.equal(issuedGridGrade(m,'2:0').outcome,'correct');
    assert.equal(issuedGridGrade(m,'1:2').outcome,'incorrect');assert.equal(m.isFinished,false);
    assert.equal(issuedGridGrade({...base,retrospectiveModelDisplay:{player1:.85}},'2:0').forecast,false);
});
test('canonical data wins over live score, preserves player identity, excludes non-rated',()=>{
    const m=match({...base,player1TPId:2,player2TPId:1,isFinished:true,calculationEligible:true,result:'20'});
    assert.equal(issuedGridGrade(m,'1:2').outcome,'incorrect');
    assert.equal(issuedGridGrade({...m,calculationEligible:false},'1:2').outcome,null);
    assert.equal(issuedGridGrade({...m,issuedGridPick:{...m.issuedGridPick,archivedWinner:1}}).outcome,null);
});
test('late receipt, duplicate, wrong player, wrong date never qualify',()=>{
    for(const rows of [[row,row],[[...row.slice(0,7),300,300,null]]]){
        const p={...packet,rows};assert.equal(validForecastGrades(p,key),false);assert.equal(match(base,p).issuedGridPick,undefined);
    }
    for(const m of [{...base,player1TPId:4},{...base,dateTime:'2026-11-24'}])assert.equal(match(m).issuedGridPick,undefined);
});
test('first display grade, score reversal and separate legacy/versioned readers',()=>{
    const p={...packet,schema:'bonzobyte.issued-forecast-grades.v2',rows:[[...row.slice(0,5),.839304389,100,100,90,null,'display',['1:2','7:6 3:6 2:6']]]};
    assert.equal(validForecastGrades(p,key,2),true);assert.equal(validForecastGrades(p,key),false);
    const m=match({...base,player1TPId:2,player2TPId:1},p);
    assert.equal(m.issuedGridPick.publicFinal.result,'2:1');
    assert.equal(issuedGridGrade(m,m.issuedGridPick.publicFinal.result).outcome,'incorrect');
});
