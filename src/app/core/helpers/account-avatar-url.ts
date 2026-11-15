import { environment } from '@env/environment';

/** Local Render uploads need the invitation cookie on the frontend domain.
 * Keep other photos/previews unchanged; never turn arbitrary URLs into proxies. */
export function accountAvatarUrl(source: string,
    closedBeta = 'closedBeta' in environment && environment.closedBeta === true): string {
    if (!closedBeta) return source;
    try {
        const url = new URL(source);
        if (url.origin === 'https://bonzobyte-backend.onrender.com' && !url.username && !url.password
            && /^\/uploads\/avatars\/[a-f0-9]{24}\/avatar-\d+\.webp$/.test(url.pathname)) {
            return url.pathname + url.search + url.hash;
        }
    } catch { /* Relative uploads, selected-file previews and fallback images stay as supplied. */ }
    return source;
}
