import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/app/core/helpers/final-match-result.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {finalMatchResult,finalMatchSets}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('a supplied final shows without a second provider or prices',()=>{
 const match={isFinished:true,result:'20',resultDetails:'2:0 6:4 6:4',qualityStatus:'Validated'};
 assert.equal(finalMatchResult(match),'2:0');assert.equal(finalMatchSets(match),'6:4 6:4');
 assert.equal(finalMatchResult({...match,isFinished:false}),null);
});
test('special endings require source text, not a partial score',()=>{
 const m={qualityStatus:'NonRatedOutcome'};
 assert.equal(finalMatchResult({...m,resultDetails:'W/O'}),'W/O');
 assert.equal(finalMatchResult({...m,resultDetails:'6:4 2:1 RET'}),'RET');
 assert.equal(finalMatchResult({...m,resultDetails:'6:4 2:1'}),null);
});
