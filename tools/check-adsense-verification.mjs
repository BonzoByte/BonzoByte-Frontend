import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const publicHome = 'https://bonzobyte.com/';
const publisherFormat = /^ca-pub-[0-9]{16}$/;

// Check the initial response used for Google's meta-tag verification. This does
// not replace a browser/network check of a future ad or consent integration.
export function checkVerificationHtml(html, publisher) {
    if (publisher !== undefined && !publisherFormat.test(publisher))
        throw Error('Expected a public ca-pub- identifier with 16 digits.');

    const document = html.replace(/<!--[\s\S]*?-->/g, '');
    const head = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(document)?.[1];
    if (head === undefined) throw Error('Expected a complete HTML head.');
    if (/adsbygoogle|googlesyndication\.com|doubleclick\.net|fundingchoicesmessages\.google\.com/i.test(document))
        throw Error('Found Google advertising or consent code in the initial HTML.');

    const markup = head.replace(/<(script|style|title|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    const tags = [...markup.matchAll(/<meta\s+((?:"[^"]*"|'[^']*'|[^"'<>])*)>/gi)];
    const publishers = tags.map(([, attrs]) => {
        const result = new Map();
        for (const [, name, doubleQuoted, singleQuoted, unquoted] of attrs.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=`<>]+)))?/g)) {
            const key = name.toLowerCase();
            if (!result.has(key)) result.set(key, doubleQuoted ?? singleQuoted ?? unquoted);
        }
        return result;
    }).filter(attrs => attrs.get('name') === 'google-adsense-account');

    if (publisher === undefined && publishers.length !== 0)
        throw Error('A publisher tag appeared before verification was requested.');
    if (publisher !== undefined && (publishers.length !== 1 || publishers[0].get('content') !== publisher))
        throw Error('Expected exactly one matching google-adsense-account meta tag in the head.');
}

async function run(args) {
    const live = args.includes('--live');
    const publishers = args.filter(arg => arg.startsWith('--publisher='));
    if (publishers.length > 1 || args.some(arg => arg !== '--live' && !arg.startsWith('--publisher=')))
        throw Error('Usage: node tools/check-adsense-verification.mjs [--live] [--publisher=ca-pub-…]');
    const publisher = publishers[0]?.slice('--publisher='.length);
    let html;
    if (live) {
        const response = await fetch(publicHome, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
        if (response.status !== 200 || !response.headers.get('content-type')?.toLowerCase().startsWith('text/html'))
            throw Error('The public homepage did not return HTTP 200 HTML.');
        html = await response.text();
    } else {
        html = await readFile(new URL('../dist/frontend/browser/index.html', import.meta.url), 'utf8');
    }
    checkVerificationHtml(html, publisher);
    console.log(`${live ? 'Public homepage' : 'Local build'}: ${publisher ? 'matching verification tag' : 'no publisher tag'}; no Google ad or consent code in initial HTML.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    run(process.argv.slice(2)).catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
