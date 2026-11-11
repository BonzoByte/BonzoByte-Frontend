export const environment = {
    production: true,
    analyticsEnabled: false, // Enable only after privacy notice and GA property settings are reviewed.
    billingLab: false,
    // Safe public launch: no ad requests while site approval/CMP integration is pending.
    advertising: { enabled: false, mode: 'off' as const },

    apiUrl: 'https://bonzobyte-backend.onrender.com/api',

    archivesMode: 'api',
    apiBase: 'https://bonzobyte-backend.onrender.com/api/archives',
    dailyStaticBase: '',
};
