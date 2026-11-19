import { ArchiveCoveragePreferenceService, ARCHIVE_COVERAGE_STORAGE_KEY } from './archive-coverage-preference.service';

describe('ArchiveCoveragePreferenceService', () => {
    beforeEach(() => localStorage.removeItem(ARCHIVE_COVERAGE_STORAGE_KEY));
    afterEach(() => localStorage.removeItem(ARCHIVE_COVERAGE_STORAGE_KEY));

    it('shows the notice on the first visit', () => {
        expect(new ArchiveCoveragePreferenceService().isVisible).toBeTrue();
    });

    it('remembers dismissal after a new visit without account data', () => {
        const preference = new ArchiveCoveragePreferenceService();
        preference.dismiss();
        expect(preference.isVisible).toBeFalse();
        expect(localStorage.getItem(ARCHIVE_COVERAGE_STORAGE_KEY)).toBe('false');
        expect(new ArchiveCoveragePreferenceService().isVisible).toBeFalse();
    });

    it('does not treat other stored values as dismissal', () => {
        for (const value of ['true', '0', 'invalid']) {
            localStorage.setItem(ARCHIVE_COVERAGE_STORAGE_KEY, value);
            expect(new ArchiveCoveragePreferenceService().isVisible).toBeTrue();
        }
    });

    it('shows safely when reading storage is blocked', () => {
        spyOn(Storage.prototype, 'getItem').and.throwError('Storage blocked');
        expect(new ArchiveCoveragePreferenceService().isVisible).toBeTrue();
    });

    it('still dismisses for the session when writing storage is blocked', () => {
        const preference = new ArchiveCoveragePreferenceService();
        spyOn(Storage.prototype, 'setItem').and.throwError('Storage blocked');
        expect(() => preference.dismiss()).not.toThrow();
        expect(preference.isVisible).toBeFalse();
    });
});
