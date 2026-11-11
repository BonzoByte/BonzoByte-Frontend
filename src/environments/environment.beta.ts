// Optimized build, same-origin gated API. No direct Render/R2/localhost fallback.
export const environment = {
    production: true,
    analyticsEnabled: false,
    closedBeta: true,
    billingLab: false,
    advertising: { enabled: false, mode: 'off' as const },
    apiUrl: '/api',
    archivesMode: 'api',
    apiBase: '/api/archives',
    dailyStaticBase: '',
};
