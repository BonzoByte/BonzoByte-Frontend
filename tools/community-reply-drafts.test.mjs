import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const code = ts.transpileModule(fs.readFileSync(new URL('../src/app/core/helpers/community-reply-drafts.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} }; vm.runInNewContext(code, { module, exports: module.exports });
const { CommunityReplyDraftStore: Store, COMMUNITY_DRAFT_PREFIX: prefix, COMMUNITY_DRAFT_TTL: ttl } = module.exports;
const a = 'a'.repeat(24), b = 'b'.repeat(24), quote = 'c'.repeat(24), requestId = 'a1234567-1234-1234-1234-123456789012';
function fixture() {
  const values = new Map(); let at = 1000000000;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null, get length() { return values.size; } };
  return { values, storage, store: new Store(() => storage, () => at), tick: value => at += value };
}
const input = (body = 'An unfinished reply') => ({ body, replyToId: null, requestId });
test('drafts survive a new store instance and keep whitespace, quote target and replay ID', () => {
  const f = fixture(), value = { ...input('  Line one\n🎾 Line two  '), replyToId: quote };
  assert.equal(f.store.save(a, 42, value), true);
  const restored = new Store(() => f.storage, () => 1000000001).load(a, 42);
  assert.equal(restored.available, true); assert.equal(restored.draft.body, value.body);
  assert.equal(restored.draft.replyToId, quote); assert.equal(restored.draft.requestId, requestId);
});
test('account and topic scopes never mix; guests have no storage access', () => {
  const f = fixture(); f.store.save(a, 42, input('A/42')); f.store.save(a, 43, input('A/43')); f.store.save(b, 42, input('B/42'));
  assert.equal(f.store.load(a, 42).draft.body, 'A/42'); assert.equal(f.store.load(a, 43).draft.body, 'A/43'); assert.equal(f.store.load(b, 42).draft.body, 'B/42');
  assert.equal(f.store.load('', 42).draft, null); assert.equal(f.store.save('', 42, input()), false);
  assert.equal(f.store.load(a, -1).draft, null); assert.equal(f.values.size, 3);
});
test('discard and blank text remove only this account/topic, preserving unrelated preferences', () => {
  const f = fixture(); f.values.set('unrelated', 'keep'); f.store.save(a, 42, input()); f.store.save(b, 42, input());
  assert.equal(f.store.save(a, 42, input(' \n ')), true); assert.equal(f.store.load(a, 42).draft, null);
  assert.ok(f.store.load(b, 42).draft); assert.equal(f.values.get('unrelated'), 'keep');
});
test('expired, malformed and oversized entries are ignored without touching other accounts', () => {
  const f = fixture(); f.store.save(a, 42, input()); f.store.save(b, 42, input()); f.tick(ttl + 1);
  assert.equal(f.store.load(a, 42).draft, null); assert.equal(f.values.has(prefix + b + '.42'), true);
  f.values.set(prefix + a + '.42', '{broken'); assert.equal(f.store.load(a, 42).draft, null);
  f.values.set(prefix + a + '.42', 'x'.repeat(200001)); assert.equal(f.store.load(a, 42).draft, null);
  assert.equal(f.store.save(a, 42, input('x'.repeat(32001))), false);
  assert.equal(f.store.save(a, 42, { ...input(), replyToId: '<script>' }), false);
});
test('storage denial or quota errors never throw and never claim a successful save', () => {
  const missing = new Store(() => null); assert.equal(missing.load(a, 1).available, false); assert.equal(missing.save(a, 1, input()), false);
  const throwing = new Store(() => { throw Error('denied'); }); assert.equal(throwing.load(a, 1).available, false); assert.equal(throwing.clear(a, 1), false);
  const f = fixture(); f.store.save(a, 42, input('Kept')); f.storage.setItem = () => { throw Error('quota'); };
  assert.equal(f.store.save(a, 42, input('Not saved')), false); assert.equal(f.store.load(a, 42).draft.body, 'Kept');
});
test('successful send clears only its own request, not a newer draft from another tab', () => {
  const f = fixture(); f.store.save(a, 42, input('Old')); const newer = { ...input('Newer'), requestId: 'b1234567-1234-1234-1234-123456789012' };
  f.store.save(a, 42, newer); assert.equal(f.store.clear(a, 42, requestId), true); assert.equal(f.store.load(a, 42).draft.body, 'Newer');
  assert.equal(f.store.clear(a, 42, newer.requestId), true); assert.equal(f.store.load(a, 42).draft, null);
});
test('bounded storage never silently evicts another unfinished reply', () => {
  const f = fixture(); for (let topic = 1; topic <= 32; topic++) assert.equal(f.store.save(a, topic, input()), true);
  assert.equal(f.store.save(a, 33, input()), false); assert.equal(f.values.size, 32);
  assert.equal(f.store.save(a, 1, input('Updated')), true); assert.equal(f.store.load(a, 1).draft.body, 'Updated');
});
