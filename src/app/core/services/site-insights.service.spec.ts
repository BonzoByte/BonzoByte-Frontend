import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { provideHttpClient, HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';
import { User } from '../models/user.model';
import { PrivacyConsentService, PRIVACY_STORAGE_KEY } from './privacy-consent.service';
import { SiteInsightsService, SITE_INSIGHTS_OPTIONS, INSIGHTS_EXCLUDED_KEY, INSIGHTS_VISITOR_KEY, siteInsightsSection } from './site-insights.service';

describe('SiteInsightsService', () => {
    let service: SiteInsightsService, http: HttpTestingController, identity: BehaviorSubject<User | null>, changes: BehaviorSubject<null>;
    let consent: boolean, origin: { origin: string }, privacy: { allowsSiteAnalytics(): boolean; changes: BehaviorSubject<null> };
    const keys = [INSIGHTS_EXCLUDED_KEY, INSIGHTS_VISITOR_KEY, 'bonzobyte.siteInsights.pendingPurge.v1'];
    const guest = { allowed: false, internal: false, enabled: true };
    const owner = { _id: 'synthetic-owner', email: 'horvat.stanko@gmail.com', isVerified: true } as User;
    beforeEach(() => {
        keys.forEach(k => localStorage.removeItem(k)); consent = false; origin = { origin: 'https://bonzobyte.com' };
        identity = new BehaviorSubject<User | null>(null); changes = new BehaviorSubject<null>(null);
        privacy = { allowsSiteAnalytics: () => consent, changes };
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
            { provide: AuthService, useValue: { user$: identity, getAccessToken: () => null } },
            { provide: PrivacyConsentService, useValue: privacy }, { provide: SITE_INSIGHTS_OPTIONS, useValue: { enabled: true } },
            { provide: DOCUMENT, useValue: { defaultView: { location: origin, localStorage, crypto, addEventListener: () => {}, removeEventListener: () => {} } } }
        ] });
        service = TestBed.inject(SiteInsightsService); http = TestBed.inject(HttpTestingController);
    });
    afterEach(() => { service.ngOnDestroy(); http.verify(); keys.forEach(k => localStorage.removeItem(k)); });
    const resolveGuest = (controller: HttpTestingController) => controller.expectOne('/api/site-insights/access').flush(guest);

    it('does not create identifiers or send views before separate consent', () => {
        service.page('/matches'); resolveGuest(http); http.expectNone('/api/site-insights/view');
        expect(localStorage.getItem(INSIGHTS_VISITOR_KEY)).toBeNull();
    });
    it('tracks only approved section names, without search terms, fragments or account identifiers', () => {
        consent = true; service.page('/matches?q=private-email#secret'); resolveGuest(http);
        const request = http.expectOne('/api/site-insights/view'); expect(request.request.body.section).toBe('matches');
        expect(JSON.stringify(request.request.body)).not.toContain('private-email'); expect(Object.keys(request.request.body)).not.toContain('userId');
        request.flush({ accepted: true }); changes.next(null); http.expectNone('/api/site-insights/view');
        service.page('/site-insights'); http.expectNone('/api/site-insights/view');
        expect(siteInsightsSection('/players/matches/123?email=private')).toBe('players');
        expect(siteInsightsSection('/oauth-success?token=private')).toBeNull();
    });
    it('does not record localhost or preview requests even with consent', () => {
        consent = true; origin.origin = 'http://localhost:4200'; service.page('/matches'); resolveGuest(http);
        http.expectNone('/api/site-insights/view'); origin.origin = 'https://preview.vercel.app'; service.page('/players');
        http.expectNone('/api/site-insights/view'); expect(localStorage.getItem(INSIGHTS_VISITOR_KEY)).toBeNull();
    });
    it('remembers an internal browser after logout and across a new service instance', () => {
        consent = true; identity.next(owner); service.page('/matches');
        http.expectOne('/api/site-insights/access').flush({ ...guest, allowed: true, internal: true });
        expect(service.excluded()).toBeTrue(); expect(localStorage.getItem(INSIGHTS_EXCLUDED_KEY)).toBe('1');
        identity.next(null); resolveGuest(http); service.page('/players'); http.expectNone('/api/site-insights/view');
        const duplicate = new SiteInsightsService(TestBed.inject(HttpClient), TestBed.inject(AuthService), privacy as unknown as PrivacyConsentService,
            TestBed.inject(DOCUMENT), { enabled: true });
        expect(duplicate.excluded()).toBeTrue(); duplicate.ngOnDestroy();
    });
    it('manual exclusion purges an existing identifier; inclusion never grants consent', () => {
        consent = true; service.page('/matches'); resolveGuest(http); http.expectOne('/api/site-insights/view').flush({ accepted: true });
        service.setExcluded(true); const purge = http.expectOne('/api/site-insights/opt-out'); expect(purge.request.body.visitorId).toBeTruthy(); purge.flush({ removed: true });
        expect(localStorage.getItem(INSIGHTS_VISITOR_KEY)).toBeNull(); consent = false; service.setExcluded(false); http.expectNone('/api/site-insights/view');
    });
    it('withdrawal stops new views and retries an interrupted removal without resuming tracking', () => {
        consent = true; service.page('/matches'); resolveGuest(http); http.expectOne('/api/site-insights/view').flush({ accepted: true });
        consent = false; changes.next(null); http.expectOne('/api/site-insights/opt-out').flush({}, { status: 503, statusText: 'Unavailable' });
        service.page('/players'); http.expectOne('/api/site-insights/opt-out').flush({ removed: true });
        http.expectNone('/api/site-insights/view'); expect(localStorage.getItem('bonzobyte.siteInsights.pendingPurge.v1')).toBeNull();
    });
    it('ignores a late access result after account identity changes', () => {
        service.start(); const stale = http.expectOne('/api/site-insights/access'); identity.next(owner);
        const current = http.expectOne('/api/site-insights/access'); stale.flush({ ...guest, allowed: true, internal: true });
        expect(service.access().allowed).toBeFalse(); expect(service.excluded()).toBeFalse(); current.flush({ ...guest, allowed: true, internal: true });
        expect(service.excluded()).toBeTrue();
    });
});

describe('Site insights consent purpose', () => {
    let privacy: PrivacyConsentService;
    afterEach(() => { privacy?.ngOnDestroy(); localStorage.removeItem(PRIVACY_STORAGE_KEY); });
    it('requires a new decision and old two-argument saves do not grant the new purpose', () => {
        const now = Date.now(); localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify({ version: 1,
            policy: '2026-10-04.2:popularity-2026-10-04.1:analytics-disabled', analytics: true, popularity: true,
            decidedAt: now, expiresAt: now + 180 * 86400000 }));
        privacy = new PrivacyConsentService(document, { analyticsEnabled: false, measurementId: 'G-TEST', siteAnalyticsEnabled: true });
        expect(privacy.choice()).toBeNull(); privacy.save(true, true); expect(privacy.allowsSiteAnalytics()).toBeFalse();
        privacy.save(false, false, true); expect(privacy.allowsSiteAnalytics()).toBeTrue();
        privacy.save(false, false, false); expect(privacy.allowsSiteAnalytics()).toBeFalse();
    });
});
