import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ts=createRequire(import.meta.url)('typescript');
function load(relative,probabilityFirst=true){
  const filename=path.resolve(root,relative);const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const require=name=>name==='@env/environment'?{environment:{probabilityFirst}}:load(path.relative(root,path.resolve(path.dirname(filename),name+'.ts')),probabilityFirst);
  vm.runInNewContext(code,{module,exports:module.exports,require,Object,Number,Array,console},{filename});return module.exports;
}
const helper='src/app/core/helpers/model-odds.ts';
test('model performance opens at 60 percent without locking the threshold',()=>{
  const filename=path.join(root,'src/app/tennis/model-performance/model-performance.component.ts'),module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:name=>name==='@angular/core'?{Component:()=>value=>value}:{},Object,Number,Array,console},{filename});
  const Component=module.exports.ModelPerformanceComponent;
  const first=new Component(null,null);assert.equal(first.threshold,60);
  first.scope='ATP';assert.equal(first.threshold,60);first.scope='WTA';assert.equal(first.threshold,60);
  first.threshold=70;assert.equal(first.threshold,70);assert.equal(new Component(null,null).threshold,60);
});
test('model odds use explicit probability units and reject invalid values',()=>{
  const {modelDecimalOdds:odds}=load(helper);
  assert.equal(odds(.5,'fraction'),2);assert.equal(odds(50,'percent'),2);
  assert.equal(odds(.8,'fraction'),1.25);assert.equal(odds(80,'percent'),1.25);
  assert.ok(odds(.9,'percent')>100);
  for(const value of [0,1,-1,Infinity,NaN,null,'0.5'])assert.equal(odds(value,'fraction'),null);
});
test('presentation switch preserves the legacy non-local mode',()=>{
  assert.equal(load(helper,true).PROBABILITY_FIRST,true);assert.equal(load(helper,false).PROBABILITY_FIRST,false);
});
test('all 16 languages contain complete probability-first copy',()=>{
  const {probabilityFirstCopy:copy}=load('src/app/core/i18n/probability-first-copy.ts');
  const keys=Object.keys(copy('en'));
  for(const language of ['en','hr','bs','sr-Latn','sl','de','es','fr','it','pt-BR','ru','ja','pl','cs','sk','hu']){
    const value=copy(language);assert.deepEqual(Object.keys(value).sort(),[...keys].sort());
    for(const key of keys)assert.equal(typeof value[key],'string',language+':'+key);
    assert.ok(value.oddsWarning.length>30);assert.ok(value.disclosure.length>30);
  }
  assert.equal(copy('hr').title,'Uspješnost modela');assert.equal(copy('de').title,'Modellleistung');
});
test('market filters are bypassed and their saved state sanitized locally',()=>{
  const source=fs.readFileSync(path.join(root,'src/app/tennis/matches/matches.component.ts'),'utf8');
  assert.match(source,/!this\.probabilityFirst && this\.activeOdds !== 'all'/);
  assert.match(source,/!this\.probabilityFirst && this\.valueFilter === 'valueOnly'/);
  assert.match(source,/this\.activeOdds = this\.probabilityFirst \? 'all'/);
  assert.match(source,/this\.valueFilter = this\.probabilityFirst \? 'all'/);
});
