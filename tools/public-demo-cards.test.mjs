import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { checkVerificationHtml } from './check-adsense-verification.mjs';

const ts = createRequire(import.meta.url)('typescript');
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function load(file, globals = {}) {
    const { outputText } = ts.transpileModule(read(file), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
    });
    const exports = {};
    vm.runInNewContext(outputText, { exports, ...globals });
    return exports;
}

const mode = load('src/app/core/helpers/advertising-mode.ts');
const layout = load('src/app/core/helpers/demo-ad-layout.ts');
const { environment } = load('src/environments/environment.beta.ts');
const live = new URL('https://bonzobyte.com/matches?ad-preview=sponsor');

test('public example cards do not switch on a real ad mode', () => {
    assert.equal(mode.resolveAdvertisingMode(environment, live.hostname), 'off');
    assert.equal(mode.allowsPublicDemoCards(environment, live), true);
    assert.equal(mode.allowsPublicDemoCards(environment, new URL('https://www.bonzobyte.com/')), true);
    for (const url of ['http://bonzobyte.com', 'https://bonzobyte.com.example.org', 'https://example.vercel.app', 'http://localhost:4200']) {
        assert.equal(mode.allowsPublicDemoCards(environment, new URL(url)), false);
    }
    assert.equal(mode.allowsPublicDemoCards({ ...environment, advertising: { enabled: false, mode: 'off' } }, live), false);
    assert.equal(mode.allowsPublicDemoCards({ ...environment, advertising: { ...environment.advertising, enabled: true, mode: 'adsense' } }, live), false);
    checkVerificationHtml(read('src/index.html'));
});

test('public cards occupy a limited number of presentation rows only', () => {
    for (const [modeName, interval] of [['matches', 32], ['groups', 4]]) {
        assert.equal(layout.demoAdSlotAfter(0, interval + 1, modeName, true), null);
        assert.equal(layout.demoAdSlotAfter(interval - 1, interval, modeName, true), null);
        assert.equal(layout.demoAdSlotAfter(interval - 1, interval + 1, modeName, true), 1);
        assert.equal(layout.demoAdSlotAfter(interval * 3 - 1, interval * 5, modeName, true), 3);
        assert.equal(layout.demoAdSlotAfter(interval * 4 - 1, interval * 5, modeName, true), null);
    }
});

test('cards honor ad-free accounts and dismissal persists only for the browser session', () => {
    const session = new Map();
    const make = (storage = { getItem: key => session.get(key), setItem: (key, value) => session.set(key, value) }) => {
        const { AdDisplayPreferenceService } = load('src/app/core/services/ad-display-preference.service.ts', {
            location: live, sessionStorage: storage, require: name => {
                if (name === '@angular/core') return { Injectable: () => Type => Type };
                if (name === '@env/environment') return { environment };
                if (name.endsWith('/demo-ad-layout')) return layout;
                if (name.endsWith('/advertising-mode')) return mode;
                throw Error('Unexpected import: ' + name);
            },
        });
        return new AdDisplayPreferenceService();
    };
    const display = make();
    assert.equal(display.showPublicDemoCards(null), true);
    assert.equal(display.showPublicDemoCards({ entitlements: { showAds: true } }), true);
    for (const entitlements of [{ showAds: false }, ...['isPremium', 'hasTrial', 'isVip', 'isLifetime'].map(key => ({ [key]: true }))]) {
        assert.equal(display.showPublicDemoCards({ entitlements }), false);
    }
    assert.equal(display.showPublicDemoCards({ isAdmin: true }), false);
    display.hidePublicDemoCards();
    assert.equal(display.showPublicDemoCards(null), false);
    assert.equal(make().showPublicDemoCards(null), false);
    const blocked = make({ getItem() { throw Error(); }, setItem() { throw Error(); } });
    assert.equal(blocked.showPublicDemoCards(null), true);
    blocked.hidePublicDemoCards();
    assert.equal(blocked.showPublicDemoCards(null), false);
});

test('creative templates have no link, provider, remote image or second action', () => {
    const html = read('src/app/shared/ui/demo-ad/demo-ad.component.html');
    assert.doesNotMatch(html, /<a\b|<iframe\b|<script\b|<img\b|\bhref\s*=|\bsrc\s*=/i);
    assert.equal([...html.matchAll(/<button\b/g)].length, 1);
    assert.equal([...html.matchAll(/<svg\b/g)].length, 3);
    assert.match(html, /demoAds\.note/);
});
