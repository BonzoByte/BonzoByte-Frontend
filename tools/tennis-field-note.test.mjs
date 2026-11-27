import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {next,rewrite} from '@vercel/functions';
import {createBetaProxy} from '../server/beta-proxy.mjs';
const origin='https://bonzobyte.com';
const go=(path,mode='public',method='GET')=>createBetaProxy({settings:{APP_STAGE:'beta',BETA_PUBLIC_ORIGIN:origin,BETA_BACKEND_ORIGIN:'https://backend.invalid',SITE_ACCESS_MODE:mode},next,rewrite})(new Request(origin+path,{method}));
test('the article and daily desk are the only indexable routes; no client execution needed',async()=>{
 const r=await go('/tennis-stats');assert.equal(r.status,200);assert.equal(r.headers.get('x-robots-tag'),'index, follow');
 const body=await r.text();assert.ok(body.includes('rel="canonical" href="'+origin+'/tennis-stats"'));assert.ok(body.includes('https://bonzobyte.com/matches/id/1937042'));assert.match(body,/Yusuke Takahashi/);assert.doesNotMatch(body,/noindex|127\.0\.0\.1|<script/i);
 const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url)));
 const rule=config.headers.find(r=>r.headers.some(h=>h.key.toLowerCase()==='x-robots-tag'));
 const noindex=new RegExp('^'+rule.source+'$');assert.equal(noindex.test('/tennis-stats'),false);
 assert.equal(noindex.test('/tennis-today'),false);assert.equal(noindex.test('/tennis-today-any'),true);
 assert.equal((await go('/tennis-today/')).headers.get('location'),'/tennis-today');assert.equal((await go('/tennis-today','invited')).status,303);
 for(const p of ['/','/matches','/my-profile','/api/archives/status','/tennis-stats-any','/tennis-stats/note']){assert.ok(noindex.test(p));assert.match((await go(p)).headers.get('x-robots-tag'),/noindex/);}
 assert.equal((await go('/tennis-stats/')).headers.get('location'),'/tennis-stats');
 assert.equal(await (await go('/tennis-stats','public','HEAD')).text(),'');
 assert.equal((await go('/tennis-stats','invited')).status,303);assert.equal((await go('/tennis-stats','public','POST')).status,403);
});
test('robots advertises both public editorial pages in public mode only',async()=>{
 assert.ok((await (await go('/robots.txt')).text()).includes('Sitemap: '+origin+'/sitemap.xml'));
 assert.doesNotMatch(await (await go('/robots.txt','invited')).text(),/Sitemap/);
 const r=await go('/sitemap.xml');assert.match(r.headers.get('content-type'),/xml/);
 assert.deepEqual([...((await r.text()).matchAll(/<loc>([^<]+)<\/loc>/g))].map(m=>m[1]),[origin+'/tennis-stats',origin+'/tennis-today']);
 assert.equal((await go('/sitemap.xml','invited')).status,303);
});
