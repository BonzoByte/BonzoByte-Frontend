import { betaWaitPage } from './beta-wait-page.mjs';
import { schedulePath, servePlannedSchedule } from './planned-schedule-feed.mjs';
import { fixturesPath, serveFixtures } from './announced-fixtures-feed.mjs';
import { modelDisplayPath, forecastGradePath, serveModelDisplay } from './model-display-feed.mjs';
import { provisionalPath, serveProvisionalResults } from './provisional-results-feed.mjs';
import { tennisFieldNote } from './tennis-field-note.mjs';

const privateHeaders = { 'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store',
    'Referrer-Policy': 'same-origin' };
const denied = (status, code) => new Response(JSON.stringify({ code }), {
    status, headers: { ...privateHeaders, 'Content-Type': 'application/json' } });
const secureOrigin = value => {
    try { const url = new URL(value); return url.protocol === 'https:' && url.origin === value ? url.origin : ''; }
    catch { return ''; }
};
const cookieName = '__Host-bonzobyte_beta';
export function createBetaProxy({ settings, next, rewrite, fetcher = fetch }) {
    return async request => {
        const publicOrigin = secureOrigin(settings.BETA_PUBLIC_ORIGIN), backend = secureOrigin(settings.BETA_BACKEND_ORIGIN);
        // Deployment is CLOSED unless explicitly configured. ng serve does not
        // run this middleware, so ordinary localhost development stays unchanged.
        if (settings.APP_STAGE !== 'beta' || !publicOrigin || !backend || publicOrigin === backend)
            return denied(503, 'BETA_NOT_CONFIGURED');
        const accessMode = settings.SITE_ACCESS_MODE ?? 'invited';
        if (!['invited', 'public'].includes(accessMode)) return denied(503, 'SITE_ACCESS_NOT_CONFIGURED');
        const url = new URL(request.url), pathname = url.pathname;
        if (url.origin !== publicOrigin) return denied(404, 'BETA_HOST_NOT_ALLOWED');
        const scheduleDay=schedulePath.exec(pathname)?.[1];
        const fixtureDay=fixturesPath.exec(pathname)?.[1];
        const fixtureResponse=()=>serveFixtures({request,day:fixtureDay,fetcher,headers:privateHeaders});
        const scheduleResponse=()=>servePlannedSchedule({request,day:scheduleDay,fetcher,headers:privateHeaders});
        const gradeDay=forecastGradePath.exec(pathname)?.[1];
        const displayKey=gradeDay??modelDisplayPath.exec(pathname)?.[1];
        const displayResponse=()=>serveModelDisplay({request,key:displayKey,fetcher,headers:privateHeaders,grades:!!gradeDay,version:pathname.startsWith('/api/forecast-grades-v2/')?2:1});
        const provisionalDay=provisionalPath.exec(pathname)?.[1];
        const provisionalResponse=()=>serveProvisionalResults({request,day:provisionalDay,fetcher,headers:privateHeaders});
        if (pathname === '/robots.txt' && ['GET', 'HEAD'].includes(request.method)) {
            const sitemap = accessMode === 'public' ? 'Sitemap: ' + publicOrigin + '/sitemap.xml\n' : '';
            return new Response(request.method === 'HEAD' ? null : 'User-agent: *\nAllow: /\n' + sitemap, { headers: { ...privateHeaders, 'Content-Type': 'text/plain' } });
        }
        const forward = () => {
            const destination = new URL(backend);
            // Assign the path instead of resolving it, so //host cannot change origin.
            destination.pathname = pathname; destination.search = url.search;
            return rewrite(destination, { headers: privateHeaders });
        };
        if (accessMode === 'public') {
            // Keep same-origin writes and server-side account authorization. Only the
            // separate, site-wide email-code entrance is removed.
            if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('origin') !== publicOrigin)
                return denied(403, 'BETA_ORIGIN_DENIED');
            if (['/tennis-stats','/tennis-stats/','/sitemap.xml'].includes(pathname)) {
                if (!['GET','HEAD'].includes(request.method)) return denied(405, 'METHOD_NOT_ALLOWED');
                if (pathname === '/tennis-stats/') return new Response(null, {status:308,headers:{...privateHeaders,Location:'/tennis-stats'+url.search}});
                const isArticle = pathname === '/tennis-stats';
                const body = isArticle ? tennisFieldNote : '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://bonzobyte.com/tennis-stats</loc></url></urlset>';
                return new Response(request.method === 'HEAD' ? null : body, {headers:{
                    ...privateHeaders,'X-Robots-Tag':isArticle ? 'index, follow' : privateHeaders['X-Robots-Tag'],
                    'Content-Type':isArticle?'text/html; charset=utf-8':'application/xml; charset=utf-8',
                }});
            }
            if (['/beta', '/beta/request', '/beta/verify', '/beta/logout'].includes(pathname)) {
                if (['GET', 'HEAD'].includes(request.method))
                    return new Response(null, { status: 303, headers: { ...privateHeaders, Location: '/' } });
                return denied(410, 'BETA_ACCESS_DISABLED');
            }
            if (scheduleDay) return scheduleResponse();
            if (fixtureDay) return fixtureResponse();
            if (displayKey) return displayResponse();
            if (provisionalDay) return provisionalResponse();
            if (pathname === '/api' || pathname.startsWith('/api/') || pathname === '/uploads'
                || pathname.startsWith('/uploads/') || pathname.startsWith('/static/')) return forward();
            return next({ headers: privateHeaders });
        }
        if (['/beta', '/beta/request', '/beta/verify', '/beta/logout'].includes(pathname)) {
            if (!['GET', 'HEAD', 'POST'].includes(request.method)) return denied(405, 'METHOD_NOT_ALLOWED');
            if (request.method === 'POST' && request.headers.get('origin') !== publicOrigin) return denied(403, 'BETA_ORIGIN_DENIED');
            return forward();
        }
        if (pathname === '/api/users/me/deletion/status' && request.method === 'POST') {
            if (request.headers.get('origin') !== publicOrigin) return denied(403, 'BETA_ORIGIN_DENIED');
            return forward(); // State-only random receipt; the beta session has been erased.
        }
        const cookies = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).filter(s => s.startsWith(cookieName + '='));
        const cookie = cookies.length === 1 && new RegExp(`^${cookieName}=[a-f0-9]{64}$`).test(cookies[0]) ? cookies[0] : '';
        const api = pathname === '/api' || pathname.startsWith('/api/');
        const needsLogin = () => api || !['GET', 'HEAD'].includes(request.method)
            ? denied(401, 'BETA_ACCESS_REQUIRED')
            : new Response(null, { status: 303, headers: { ...privateHeaders, Location: '/beta' } });
        if (!cookie) return needsLogin();
        const unavailable = reason => {
            const navigation = !api && ['GET', 'HEAD'].includes(request.method)
                && (request.headers.get('accept') || '').toLowerCase().includes('text/html');
            if (navigation) {
                console.warn('[BETA] session check temporarily unavailable:', reason);
                return new Response(request.method === 'HEAD' ? null : betaWaitPage(), {
                    status: 503, headers: { ...privateHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '5' },
                });
            }
            const response = denied(503, 'BETA_UNAVAILABLE');
            response.headers.set('Retry-After', '5');
            return response;
        };
        try {
            const response = await fetcher(backend + '/beta/session', { method: 'GET', headers: { cookie },
                cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) });
            if (response.status === 401 || response.status === 403) return needsLogin();
            if (!response.ok) return unavailable('upstream-' + response.status);
            if ((await response.json()).betaAccess !== true) return unavailable('invalid-session-response');
        } catch (error) {
            return unavailable(['AbortError','TimeoutError'].includes(error?.name) ? 'timeout' : 'network-or-response');
        }
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('origin') !== publicOrigin)
            return denied(403, 'BETA_ORIGIN_DENIED');
        if (scheduleDay) return scheduleResponse();
        if (fixtureDay) return fixtureResponse();
        if (displayKey) return displayResponse();
        if (provisionalDay) return provisionalResponse();
        if (api || pathname === '/uploads' || pathname.startsWith('/uploads/') || pathname.startsWith('/static/')) return forward();
        // No asset extension, favicon, _vercel or static-folder auth bypass.
        return next({ headers: privateHeaders });
    };
}
