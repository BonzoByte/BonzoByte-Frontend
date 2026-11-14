// Public status shell only: no application data, session values or external URLs.
// Only read-only navigation is retried. Forms and payment requests never retry.
export function betaWaitPage() {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Connecting — BonzoByte</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#10171d;color:#e4edf4;font:16px/1.6 system-ui,sans-serif}main{width:100%;max-width:490px;padding:28px;border:1px solid #415464;border-radius:16px;background:#18232c}small{color:#9fb5c5;letter-spacing:.12em}h1{font-size:26px;line-height:1.3;margin:12px 0}p{margin:14px 0}button,a{font:inherit}button{padding:10px 18px;background:#abdfff;color:#10171d;border:0;border-radius:8px;cursor:pointer}a{color:#abdfff;display:inline-block;margin:12px 0 0}#status{color:#b9ccda;min-height:3em}button:focus-visible,a:focus-visible{outline:3px solid #abdfff;outline-offset:4px}</style></head><body><main><small>BONZOBYTE</small><h1>Connecting to BonzoByte</h1><p>The server may be starting after a period of inactivity, or it may be temporarily unavailable.</p><p id="status" role="status" aria-live="polite">Checking again automatically for up to 90 seconds. Your private-beta access has not been changed.</p><button type="button" id="retry">Try again</button><br><a href="/beta">Open private-beta sign-in</a></main><script>
(() => {
    const deadline = Date.now() + 90000;
    const status = document.getElementById('status');
    document.getElementById('retry').addEventListener('click', () => location.reload());
    async function check() {
        if (Date.now() >= deadline) {
            status.textContent = 'The server is still unavailable. Please try again in a moment.';
            return;
        }
        try {
            const response = await fetch(location.href, { method: 'HEAD', credentials: 'same-origin',
                cache: 'no-store', redirect: 'follow', headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(8000) });
            if (response.ok) { location.reload(); return; }
        } catch { /* A failed read never changes access or resubmits a form. */ }
        setTimeout(check, 5000);
    }
    setTimeout(check, 2000);
})();</script></body></html>`;
}
