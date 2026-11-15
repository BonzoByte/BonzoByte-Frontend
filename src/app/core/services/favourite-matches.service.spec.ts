import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { FavouriteMatchesService, FavouriteMatchRows } from './favourite-matches.service';

describe('Private match favourites', () => {
    let service: FavouriteMatchesService, http: HttpTestingController;
    let users: BehaviorSubject<any>, events: Map<string, () => void>;
    let snack: jasmine.SpyObj<any>, confirmation: { dismiss: jasmine.Spy };
    const base = '/api/favourites/matches';
    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
        http = TestBed.inject(HttpTestingController); users = new BehaviorSubject<any>(null); events = new Map();
        confirmation = { dismiss: jasmine.createSpy('dismiss') };
        snack = jasmine.createSpyObj('LocalizedSnackbarService', ['open']);
        snack.open.and.returnValue(confirmation);
        service = new FavouriteMatchesService(TestBed.inject(HttpClient), { user$: users } as any,
            { defaultView: { addEventListener: (key: string, fn: () => void) => events.set(key, fn),
                removeEventListener: (key: string) => events.delete(key) } } as any, snack);
        service.start();
    });
    afterEach(() => { service.ngOnDestroy(); http.verify(); });
    function signIn(ids: number[] = [], actor = 'fixture-a') {
        users.next({ _id: actor });
        http.expectOne(base).flush({ ids, count: ids.length, limit: 1000 });
    }
    it('does not request private data anonymously; account change immediately clears old state', () => {
        expect(service.signedIn()).toBeFalse(); service.toggle(42); http.expectNone(base);
        signIn([42]); expect(service.count()).toBe(1);
        users.next({ _id: 'fixture-b' }); expect(service.count()).toBe(0);
        http.expectOne(base).flush({ ids: [73], count: 1, limit: 1000 });
        expect(service.isSaved(42)).toBeFalse(); expect(service.isSaved(73)).toBeTrue();
        users.next(null); expect(service.count()).toBe(0); expect(service.signedIn()).toBeFalse();
    });
    it('adds only after confirmation and prevents duplicate in-flight clicks', () => {
        signIn(); service.toggle(42); service.toggle(42);
        const request = http.expectOne(base + '/42');
        expect(request.request.method).toBe('PUT'); expect(request.request.body).toEqual({});
        expect(service.pending().has(42)).toBeTrue(); expect(service.isSaved(42)).toBeFalse();
        request.flush({ matchTPId: 42, saved: true, count: 1 });
        expect(service.isSaved(42)).toBeTrue(); expect(service.pending().size).toBe(0);
        expect(service.message()).toBeNull();
        expect(snack.open).toHaveBeenCalledOnceWith('favourites.added', '', { duration: 3500, panelClass: 'success-snackbar' });
    });
    it('removes then restores with Undo, with no confirmation modal or membership restriction', fakeAsync(() => {
        signIn([42]); service.toggle(42);
        const request = http.expectOne(base + '/42'); expect(request.request.method).toBe('DELETE');
        request.flush({ matchTPId: 42, saved: false, count: 0 });
        expect(service.count()).toBe(0); expect(service.undoId()).toBe(42);
        service.undo(); http.expectOne(base + '/42').flush({ matchTPId: 42, saved: true, count: 1 });
        expect(service.count()).toBe(1); expect(service.undoId()).toBeNull();
        tick(10000); expect(service.message()).toBeNull();
    }));
    it('does not show a success toast before the server confirms; clears it on account change', () => {
        signIn(); service.toggle(42);
        expect(snack.open).not.toHaveBeenCalled();
        http.expectOne(base + '/42').flush({ matchTPId: 42, saved: true, count: 1 });
        expect(service.message()).toBeNull(); expect(service.undoId()).toBeNull();
        expect(snack.open).toHaveBeenCalledTimes(1);
        users.next(null); expect(confirmation.dismiss).toHaveBeenCalled();
    });
    it('falls back to inline feedback if the toast cannot open', fakeAsync(() => {
        signIn(); snack.open.and.throwError('Unavailable'); service.toggle(42);
        http.expectOne(base + '/42').flush({ matchTPId: 42, saved: true, count: 1 });
        expect(service.isSaved(42)).toBeTrue(); expect(service.message()).toBe('added');
        tick(10000); expect(service.message()).toBeNull();
    }));
    it('reports failed writes and reconciles the uncertain server outcome without replaying them', () => {
        signIn(); service.toggle(42);
        http.expectOne(base + '/42').flush({}, { status: 503, statusText: 'Unavailable' });
        expect(service.message()).toBe('failed'); expect(service.pending().size).toBe(0);
        http.expectOne(base).flush({ ids: [42], count: 1, limit: 1000 });
        expect(service.isSaved(42)).toBeTrue();
    });
    it('ignores malformed IDs, exposes read failure and allows explicit retry', () => {
        signIn(); for (const id of [0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) service.toggle(id);
        service.refresh(); http.expectOne(base).flush({}, { status: 503, statusText: 'Unavailable' });
        expect(service.error()).toBeTrue(); service.toggle(42); http.expectNone(base + '/42');
        service.refresh(); http.expectOne(base).flush({ ids: [42], count: 1, limit: 1000 });
        expect(service.error()).toBeFalse();
    });
    it('rejects corrupt or truncated ID lists instead of showing a misleading count', () => {
        users.next({ _id: 'fixture-a' }); http.expectOne(base).flush({ ids: [42], count: 2, limit: 1000 });
        expect(service.error()).toBeTrue(); expect(service.count()).toBe(0);
    });
    it('refreshes across devices on focus but not on every membership countdown update', () => {
        signIn([42]); users.next({ _id: 'fixture-a', entitlements: { tier: 'premium' } });
        http.expectNone(base); events.get('focus')!();
        http.expectOne(base).flush({ ids: [42, 73], count: 2, limit: 1000 });
        expect(service.count()).toBe(2);
    });
    it('resolves saved IDs only, including unavailable rows without inventing match data', () => {
        signIn([42, 73]); let rows!: FavouriteMatchRows;
        service.loadRows().subscribe(value => rows = value);
        http.expectOne(base).flush({ ids: [42, 73], count: 2, limit: 1000 });
        const resolve = http.expectOne(base + '/resolve'); expect(resolve.request.body).toEqual({ ids: [42, 73] });
        resolve.flush({ items: [{ matchTPId: 42, match: { matchTPId: 42 } }, { matchTPId: 73, match: null }] });
        expect(rows.matches.map(row => row.matchTPId)).toEqual([42]); expect(rows.unavailableIds).toEqual([73]);
    });
    it('bounds resolve batches to 50 IDs and keeps errors distinct from an empty list', () => {
        const ids = Array.from({ length: 51 }, (_, i) => i + 1); signIn(ids);
        let failed = false;
        service.loadRows().subscribe({ error: () => failed = true });
        http.expectOne(base).flush({ ids, count: 51, limit: 1000 });
        const batches = http.match(base + '/resolve');
        expect(batches.map(batch => batch.request.body.ids.length)).toEqual([50, 1]);
        batches[0].flush({ code: 'FAVOURITES_UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });
        expect(failed).toBeTrue(); expect(batches[1].cancelled).toBeTrue();
    });
    it('does not apply an old account response after logout and cancels pending rows', () => {
        signIn([42]); service.loadRows().subscribe();
        http.expectOne(base).flush({ ids: [42], count: 1, limit: 1000 });
        const resolve = http.expectOne(base + '/resolve');
        service.toggle(42); const mutation = http.expectOne(base + '/42');
        users.next(null);
        expect(resolve.cancelled).toBeTrue(); expect(mutation.cancelled).toBeTrue();
        expect(service.count()).toBe(0); expect(service.pending().size).toBe(0); expect(service.message()).toBeNull();
    });
    it('never offers Undo from the previous account', () => {
        signIn([42]); service.toggle(42); http.expectOne(base + '/42').flush({ matchTPId: 42, saved: false, count: 0 });
        expect(service.undoId()).toBe(42); users.next(null); service.undo();
        http.expectNone(base + '/42');
    });
    it('does not race a page load started by the account-change notification', () => {
        let result: FavouriteMatchRows | undefined;
        const listener = service.change$.subscribe(() => {
            if (service.signedIn()) service.loadRows().subscribe(rows => result = rows);
        });
        users.next({ _id: 'fixture-a' });
        http.expectOne(base).flush({ ids: [], count: 0, limit: 1000 });
        expect(result).toEqual({ matches: [], unavailableIds: [] });
        listener.unsubscribe();
    });
    it('reports capacity without sending a new save request', () => {
        users.next({ _id: 'fixture-a' }); http.expectOne(base).flush({ ids: [42], count: 1, limit: 1 });
        service.toggle(73); expect(service.message()).toBe('limit'); http.expectNone(base + '/73');
        service.toggle(42); http.expectOne(base + '/42').flush({ matchTPId: 42, saved: false, count: 0 });
        expect(service.count()).toBe(0);
    });
});
