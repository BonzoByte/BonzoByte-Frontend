const privateHeaders = { 'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store' };
const denied = (status, code) => new Response(JSON.stringify({ code }), {
    status, headers: { ...privateHeaders, 'Content-Type': 'application/json', 'Referrer-Policy': 'no-referrer' } });
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
        const url = new URL(request.url), pathname = url.pathname;
        if (url.origin !== publicOrigin) return denied(404, 'BETA_HOST_NOT_ALLOWED');
        if (pathname === '/robots.txt' && ['GET', 'HEAD'].includes(request.method))
            return new Response(request.method === 'HEAD' ? null : 'User-agent: *\nAllow: /\n', { headers: { ...privateHeaders, 'Content-Type': 'text/plain' } });
        const forward = () => {
            const destination = new URL(backend);
            // Assign the path instead of resolving it, so //host cannot change origin.
            destination.pathname = pathname; destination.search = url.search;
            return rewrite(destination, { headers: privateHeaders });
        };
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
            : new Response(null, { status: 303, headers: { ...privateHeaders, Location: '/beta', 'Referrer-Policy': 'no-referrer' } });
        if (!cookie) return needsLogin();
        try {
            const response = await fetcher(backend + '/beta/session', { method: 'GET', headers: { cookie },
                cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) });
            if (response.status === 401 || response.status === 403) return needsLogin();
            if (!response.ok || (await response.json()).betaAccess !== true) return denied(503, 'BETA_UNAVAILABLE');
        } catch { return denied(503, 'BETA_UNAVAILABLE'); }
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('origin') !== publicOrigin)
            return denied(403, 'BETA_ORIGIN_DENIED');
        if (api || pathname === '/uploads' || pathname.startsWith('/uploads/') || pathname.startsWith('/static/')) return forward();
        // No asset extension, favicon, _vercel or static-folder auth bypass.
        return next({ headers: privateHeaders });
    };
}
