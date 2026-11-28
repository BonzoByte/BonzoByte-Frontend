import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const src=readFileSync(new URL('../src/app/core/helpers/daily-match-details.ts',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {dailyMatchDetails}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const row={matchTPId:51,tournamentEventTPId:18,player1TPId:8,player2TPId:6,player1Name:'Swan',player2Name:'Gadecki',
    player1Rank:'157',dateTime:'2026-11-28T00:00:00',tournamentTypeName:'WTA',tournamentEventName:'Adelaide'};
test('normal details can load independent player histories before any match export',()=>{
    const d=dailyMatchDetails(row);
    assert.deepEqual([d.m001,d.t.t01,d.m004,d.m005,d.p1.p02,d.m006,d.p2.p02],[51,18,8,6,'Swan',157,'Gadecki']);
    assert.equal(d.t.t13,'WTA');assert.equal(d.m656,false);
    for(const k of ['m012','m013','m655','n','q'])assert.equal(d[k],undefined);
});
test('retains score orientation and rejects incomplete or ambiguous player identity',()=>{
    const d=dailyMatchDetails({...row,isFinished:true,result:'02',resultDetails:'3:6 1:6'});
    assert.deepEqual([d.m010,d.m011,d.m004,d.m005],['02','3:6 1:6',8,6]);
    for(const change of [{player1TPId:6},{player2TPId:0},{tournamentEventTPId:0},{dateTime:''}])
        assert.equal(dailyMatchDetails({...row,...change}),null);
});
