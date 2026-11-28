import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const src=readFileSync(new URL('../src/app/core/helpers/fixture-form.ts',import.meta.url),'utf8');
const code=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {fixtureForm}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('form is oriented to the selected player and excludes the current fixture, future, same-day, duplicate and unscored records',()=>{
  const row={matchTPId:10,dateTime:'2026-11-27T09:00:00',isFinished:true,result:'21',player1TPId:8,player2TPId:4,player1Name:'One',player2Name:'Two'};
  const rows=[row,row,{...row,matchTPId:11,dateTime:'2026-11-28'},{...row,matchTPId:12,dateTime:'2026-11-29'},
    {...row,matchTPId:13,isFinished:false},{...row,matchTPId:14,result:'W/O'},{...row,matchTPId:15}];
  const form=fixtureForm(rows,4,'2026-11-28',15);
  assert.deepEqual(form,[{match:row,id:10,date:'2026-11-27',opponent:'One',opponentId:8,won:false,score:'1:2'}]);
  assert.equal(fixtureForm(rows,8,'2026-11-28',15)[0].score,'2:1');
  assert.equal(fixtureForm(rows,9,'2026-11-28',15).length,0);
});
test('shared recent table gets the five preceding original matchups, not player-oriented score strings',()=>{
  const rows=Array.from({length:8},(_,i)=>({dateTime:'2026-11-'+(20+i),matchTPId:100+i,isFinished:true,
    player1TPId:10+i,player2TPId:4,player1Name:'Opponent '+i,player2Name:'Selected',result:'21',tournamentEventName:'Test Open'}));
  const view=fixtureForm(rows,4,'2026-11-27',900).slice(0,5);
  assert.deepEqual(view.map(x=>x.match.matchTPId),[106,105,104,103,102]);
  for(const x of view){assert.strictEqual(x.match,rows[x.id-100]);assert.equal(x.match.result,'21');assert.equal(x.score,'1:2');}
});
