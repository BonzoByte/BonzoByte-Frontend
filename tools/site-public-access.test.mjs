import test from 'node:test';
import assert from 'node:assert/strict';
import { next, rewrite } from '@vercel/functions';
import { createBetaProxy } from '../server/beta-proxy.mjs';

const origin = 'https://bonzobyte.com', backend = 'https://bonzobyte-backend.onrender.com';
const settings = { APP_STAGE: 'beta', BETA_PUBLIC_ORIGIN: origin, BETA_BACKEND_ORIGIN: backend, SITE_ACCESS_MODE: 'public' };
const req = (path, method = 'GET', headers = {}) => new Request(origin + path, { method, headers });
const handler = (override = {}) => createBetaProxy({ settings: { ...settings, ...override }, next, rewrite,
    fetcher() { assert.fail('public browsing must not fetch a beta session'); } });

test('public pages, deep links and assets open without a code or cookie', async () => {
    for (const p of ['/', '/matches', '/players', '/tournaments', '/tennis-break', '/main.js', '/assets/i18n/en.json']) {
        const response = await handler()(req(p));
        assert.equal(response.headers.get('x-middleware-next'), '1');
        assert.equal(response.headers.get('location'), null);
        assert.match(response.headers.get('cache-control'), /no-store/);
    }
});
test('public API/OAuth/photo requests keep the exact same backend and query', async () => {
    for (const p of ['/api/archives/daily/20261110', '/api/auth/google', '/api/auth/google/callback?error=access_denied', '/uploads/avatars/fixture.webp']) {
        const response = await handler()(req(p));
        assert.equal(response.headers.get('x-middleware-rewrite'), backend + p);
    }
});
test('public mode still rejects cross-origin writes and aliases', async () => {
    for (const method of ['POST', 'PATCH', 'DELETE', 'PUT']) {
        for (const bad of ['', 'null', 'https://evil.invalid'])
            assert.equal((await handler()(req('/api/users/updateUserProfile', method, { origin: bad }))).status, 403);
        const response = await handler()(req('/api/users/updateUserProfile', method, { origin }));
        assert.equal(response.headers.get('x-middleware-rewrite'), backend + '/api/users/updateUserProfile');
    }
    assert.equal((await handler()(new Request('https://old.vercel.app/'))).status, 404);
});
test('old beta links redirect internally and code requests no longer send mail', async () => {
    for (const p of ['/beta', '/beta/request', '/beta/verify', '/beta/logout']) {
        const response = await handler()(req(p + '?next=https://evil.invalid'));
        assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/');
        assert.equal((await handler()(req(p, 'POST', { origin }))).status, 410);
    }
});
test('missing public opt-in retains invite-only mode; invalid settings fail closed', async () => {
    const denied = await handler({ SITE_ACCESS_MODE: undefined })(req('/'));
    assert.equal(denied.status, 303); assert.equal(denied.headers.get('location'), '/beta');
    for (const SITE_ACCESS_MODE of ['', 'PUBLIC', 'true', 'invalid'])
        assert.equal((await handler({ SITE_ACCESS_MODE })(req('/'))).status, 503);
    for (const override of [{ APP_STAGE: 'development' }, { BETA_BACKEND_ORIGIN: 'http://bad.invalid' }, { BETA_PUBLIC_ORIGIN: undefined }])
        assert.equal((await handler(override)(req('/'))).status, 503);
});
