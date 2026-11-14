import { Routes } from '@angular/router';
export const routes: Routes = [
    { path: 'fantasy', canDeactivate: [(component: { canLeave(): boolean }) => component.canLeave()], loadComponent: () => import('./fantasy/fantasy-page.component').then(m => m.FantasyPageComponent) },
    { path: 'tennis-break', loadComponent: () => import('./arcade/tennis-break.component').then(m => m.TennisBreakComponent) },
    { path: 'auth/callback', loadComponent: () => import('./auth/oauth-success/oauth-success.component').then(m => m.OauthSuccessComponent) },
    { path: 'matches/id/:canonicalMatchId', loadComponent: () => import('./tennis/matches/match-link-page.component').then(m => m.MatchLinkPageComponent) },
    { path: 'matches/:matchTPId', loadComponent: () => import('./tennis/matches/match-link-page.component').then(m => m.MatchLinkPageComponent) },
    { path: 'competition/profiles/:profileId', loadComponent: () => import('./competition/public-predictions.component').then(m => m.PublicPredictionsComponent) },
    { path: 'predictions', data: { mine: true }, loadComponent: () => import('./competition/competition-page.component').then(m => m.CompetitionPageComponent) },
    { path: 'competition', loadComponent: () => import('./competition/leaderboard-page.component').then(m => m.LeaderboardPageComponent) },
    { path: 'popular', loadComponent: () => import('./shared/ui/popular/popular.component').then(m => m.PopularComponent) },
    { path: 'register', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
    { path: 'login', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
    {
        path: '',
        loadComponent: () =>
            import('./home/home.component').then(m => m.HomeComponent),
    },   
    {
        path: 'oauth-success',
        loadComponent: () =>
            import('./auth/oauth-success/oauth-success.component').then(m => m.OauthSuccessComponent),
    },
    {
        path: 'verify',
        loadComponent: () =>
            import('./auth/verify/verify.component').then(m => m.VerifyComponent),
    },
    {
        path: 'reset-password',
        loadComponent: () =>
            import('./auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    },
    {
        path: 'favourites',
        data: { favourites: true },
        loadComponent: () =>
            import('./tennis/matches/matches.component').then(m => m.MatchesComponent),
    },
    {
        path: 'matches',
        loadComponent: () =>
            import('./tennis/matches/matches.component').then(m => m.MatchesComponent),
    },
    {
        path: 'players/matches/:playerTPId',
        loadComponent: () =>
            import('./tennis/matches/matches.component').then(m => m.MatchesComponent),
    },    
    {
        path: 'players',
        loadComponent: () =>
            import('./tennis/players/players.component').then(m => m.PlayersComponent),
    },
    {
        path: 'tournaments',
        loadComponent: () =>
            import('./tennis/tournaments/tournaments.component').then(m => m.TournamentsComponent),
    },
    {
        path: 'tournaments/matches/:tournamentEventTPId',
        loadComponent: () =>
          import('./tennis/matches/matches.component').then(m => m.MatchesComponent)
      },   
    {
        path: 'analytics',
        loadComponent: () =>
            import('./tennis/analytics/analytics.component').then(m => m.AnalyticsComponent),
    },
    {
        path: 'model-insights',
        loadComponent: () =>
            import('./tennis/model-insights/model-insights.component').then(m => m.ModelInsightsComponent),
    },
    {
        path: 'simulation',
        loadComponent: () =>
            import('./tennis/simulation/simulation.component').then(m => m.SimulationComponent),
    },
    { path: '**', redirectTo: '' }
];
