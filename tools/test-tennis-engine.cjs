// Run the exact Jasmine engine spec without compiling the entire Angular app.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const jasmineRequire = require('jasmine-core');
const jasmine = jasmineRequire.core(jasmineRequire);
const env = jasmine.getEnv();
Object.assign(globalThis, jasmineRequire.interface(jasmine, env));
const transpile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const folder = path.join(__dirname, '../src/app/arcade');
const engines = {};
let completed = false;
process.on('beforeExit', () => {
  if (!completed) { console.error('Engine test runner did not complete; this is not a passing result.'); process.exitCode = 1; }
});
try {
for (const name of ['tennis-engine', 'tennis-scoring', 'tennis-skill', 'tennis-3d-engine', 'tennis-replay', 'tennis-atmosphere', 'tennis-soundscape', 'tennis-space-stroke', 'tennis-serve-pose', 'tennis-athlete-pose']) {
  const engine = { exports: {} };
  new Function('module', 'exports', 'require', transpile(path.join(folder, name + '.ts')))(engine, engine.exports, dependency => {
    if (!engines[dependency]) throw Error('Unexpected engine dependency: ' + dependency);
    return engines[dependency];
  });
  engines['./' + name] = engine.exports;
}
let count = 0;
const failures = [];
env.addReporter({
  specDone(result) { count++; if (result.status !== 'passed') failures.push({ name: result.fullName, failures: result.failedExpectations }); },
  jasmineDone(result) {
    completed = true;
    console.log(JSON.stringify({ specs: count, status: result.overallStatus, failures }, null, 2));
    if (result.overallStatus !== 'passed') process.exitCode = 1;
  }
});
for (const file of ['tennis-engine.spec.ts', 'tennis-scoring.spec.ts', 'tennis-3d-engine.spec.ts', 'tennis-charge.spec.ts', 'tennis-career-kernel.spec.ts', 'tennis-service-flight.spec.ts', 'tennis-soundscape.spec.ts', 'tennis-atmosphere.spec.ts', 'tennis-space-stroke.spec.ts', 'tennis-serve-pose.spec.ts', 'tennis-athlete-pose.spec.ts']) {
  new Function('require', 'exports', transpile(path.join(folder, file)))(name => {
    if (name === 'three') return require('three');
    if (!engines[name]) throw Error('Unexpected engine test dependency: ' + name);
    return engines[name];
  }, {});
}
env.execute().catch(error => { console.error(error); process.exitCode = 1; });
} catch (error) { console.error('Engine test runner loading failed:', error); process.exitCode = 1; }
