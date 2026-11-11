export const environment = {
  production: false,
  analyticsEnabled: false, // Real tracking is disabled during development; consent UI can be tested.
  billingLab: false,
  advertising: { enabled: true, mode: 'demo' as const },
  apiUrl: '/api',

  archivesMode: 'api',
  apiBase: '/api/archives',
  dailyStaticBase: '',
};
