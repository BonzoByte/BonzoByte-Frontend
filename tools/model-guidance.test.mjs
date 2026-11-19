import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ts=createRequire(import.meta.url)('typescript');
const service='src/app/core/services/model-guidance-preference.service.ts';
const component='src/app/user/user-modal/user-modal.component.ts';
function harness(storageAvailable=true){
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const core={ViewEncapsulation:{None:0},Injectable:()=>x=>x,Component:()=>x=>x,Output:()=>()=>{},ViewChild:()=>()=>{},Optional:()=>()=>{},Inject:()=>()=>{},
    EventEmitter:class{calls=0;emit(){this.calls++;}},signal:initial=>{let value=initial;const read=()=>value;read.set=next=>value=next;return read;}};
  const forms={Validators:{minLength:()=>()=>null,maxLength:()=>()=>null}};
  const modules=new Map();
  function load(relative){
    if(modules.has(relative))return modules.get(relative);
    const filename=path.join(root,relative),module={exports:{}};
    const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
    const require=name=>name==='@angular/core'?core:name==='@angular/forms'?forms:name.endsWith('/model-guidance-preference.service')?load(service):name.endsWith('/model-odds')?{PROBABILITY_FIRST:true}:{};
    vm.runInNewContext(code,{module,exports:module.exports,require,Number,String,Object,Array,Date,console,
      ...(storageAvailable?{localStorage:storage}:{}),document:{body:{classList:{add(){},remove(){}}}},setTimeout,clearTimeout},{filename});
    modules.set(relative,module.exports);return module.exports;
  }
  return {values,storage,load};
}
test('first visit is visible without changing any other preference',()=>{
  const h=harness(),{ModelGuidancePreferenceService:S}=h.load(service);
  h.values.set('unrelated','keep');assert.equal(new S().isVisible,true);assert.equal(h.values.size,1);
});
test('closing survives reload and applies independently of guest or signed-in identity',()=>{
  const h=harness(),{ModelGuidancePreferenceService:S,MODEL_GUIDANCE_STORAGE_KEY:key}=h.load(service);
  new S().setVisible(false);assert.equal(h.values.get(key),'false');assert.equal(new S().isVisible,false);
  assert.equal(new S().isVisible,false);assert.equal(h.values.size,1);
});
test('explicitly enabling the notice persists its return',()=>{
  const h=harness(),{ModelGuidancePreferenceService:S}=h.load(service);const state=new S();
  state.setVisible(false);state.setVisible(true);assert.equal(new S().isVisible,true);
});
test('blocked browser storage keeps the choice for the current session',()=>{
  const h=harness();h.storage.getItem=()=>{throw Error('blocked');};h.storage.setItem=()=>{throw Error('blocked');};
  const {ModelGuidancePreferenceService:S}=h.load(service);const state=new S();assert.equal(state.isVisible,true);
  state.setVisible(false);assert.equal(state.isVisible,false);
});
test('missing browser storage does not crash rendering',()=>{
  const {ModelGuidancePreferenceService:S}=harness(false).load(service);const state=new S();
  state.setVisible(false);assert.equal(state.isVisible,false);
});
function profile(h){
  const {ModelGuidancePreferenceService:S}=h.load(service),preference=new S();
  class Control{constructor(value){if(value&&typeof value==='object'&&'value'in value){this.value=value.value;this.disabled=value.disabled;}else this.value=value;}setValue(value){this.value=value;}}
  const fb={control:value=>new Control(value),group:fields=>{
    const controls=Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,value instanceof Control?value:new Control(value[0])]));
    return {get:key=>controls[key],patchValue:values=>Object.entries(values).forEach(([key,value])=>controls[key]?.setValue(value)),
      markAsDirty(){},markAsPristine(){},markAllAsTouched(){},updateValueAndValidity(){},pending:false,invalid:false,valueChanges:{subscribe:()=>({unsubscribe(){}})}};
  }};
  const user={_id:'fixture-only',nickname:'Tester',email:'fixture@example.invalid',createdVia:'manual',isVerified:true};let writes=0;
  const auth={getUser:()=>user,updateUser:()=>{writes++;throw Error('Unexpected account write');}};
  const theme={selectedTheme:'dark',setTheme(){}},overview={isVisible:true,setVisible(){}},quick={current:{odds:false,value:false,status:false},set(){}},zone={isVisible:true,setVisible(){}},ads={isHidden:()=>false,canHide:()=>false,setHidden(){}};
  const {UserModalComponent:C}=h.load(component);
  const c=new C(fb,auth,{open(){}},theme,overview,quick,zone,ads,{},null,preference);c.ngOnInit();c.activeTab='display';
  return {c,preference,get writes(){return writes;}};
}
test('Display defaults remain a draft until Save and do not call the account API',()=>{
  const h=harness(),{MODEL_GUIDANCE_STORAGE_KEY:key}=h.load(service);h.values.set(key,'false');h.values.set('unrelated','keep');
  const p=profile(h);assert.equal(p.c.userForm.get('modelGuidanceVisible').value,false);
  p.c.restoreDisplayDefaults();assert.equal(p.c.userForm.get('modelGuidanceVisible').value,true);
  assert.equal(p.c.hasUnsavedChanges,true);assert.equal(h.values.get(key),'false');
  p.c.onSubmit();assert.equal(h.values.get(key),'true');assert.equal(p.writes,0);assert.equal(h.values.get('unrelated'),'keep');
  assert.equal(p.c.hasUnsavedChanges,false);assert.equal(p.c.closed.calls,1);
});
test('an unsaved checkbox edit never changes the stored dismissal',()=>{
  const h=harness(),p=profile(h);p.c.userForm.get('modelGuidanceVisible').setValue(false);
  assert.equal(p.c.hasUnsavedChanges,true);assert.equal(p.preference.isVisible,true);
  assert.equal(h.values.size,0);assert.equal(p.writes,0);
});
