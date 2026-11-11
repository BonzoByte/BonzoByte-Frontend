import type { next as nextResponse, rewrite as rewriteResponse } from '@vercel/functions';

export function createBetaProxy(options: {
    settings: Record<string, string | undefined>;
    next: typeof nextResponse;
    rewrite: typeof rewriteResponse;
    fetcher?: typeof fetch;
}): (request: Request) => Promise<Response>;
