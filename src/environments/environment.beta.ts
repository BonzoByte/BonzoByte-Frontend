// Optimized build, same-origin gated API. No direct Render/R2/localhost fallback.
export const environment = {
    production: true,
    communityEnabled: true,
    siteAnalyticsEnabled: true,
    probabilityFirst: true,
    analyticsEnabled: false,
    closedBeta: true,
    billingLab: false,
    advertising: { enabled: false, mode: 'off' as const, publicDemoCards: true },
    apiUrl: '/api',
    archivesMode: 'api',
    apiBase: '/api/archives',
    dailyStaticBase: '',
};
