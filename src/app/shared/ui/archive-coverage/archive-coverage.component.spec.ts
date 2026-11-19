import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { ArchiveCoverageComponent } from './archive-coverage.component';
import { ArchiveCoverageService } from '../../../core/services/archive-coverage.service';
import { ARCHIVE_COVERAGE_STORAGE_KEY } from '../../../core/services/archive-coverage-preference.service';

describe('ArchiveCoverageComponent', () => {
    let coverageSource: BehaviorSubject<{ fromDate: string; through: string } | null>;
    beforeEach(async () => {
        localStorage.removeItem(ARCHIVE_COVERAGE_STORAGE_KEY);
        coverageSource = new BehaviorSubject<{ fromDate: string; through: string } | null>({ fromDate: '2026-11-01', through: '2026-11-16' });
        await TestBed.configureTestingModule({
            imports: [ArchiveCoverageComponent, TranslateModule.forRoot()],
            providers: [{ provide: ArchiveCoverageService, useValue: {
                coverage$: coverageSource
            } }]
        }).compileComponents();
        const translate = TestBed.inject(TranslateService);
        translate.setTranslation('en', { common: { close: 'Close' }, archiveCoverage: { notice: 'Coverage {{from}}–{{through}}' } });
        translate.use('en');
    });
    afterEach(() => localStorage.removeItem(ARCHIVE_COVERAGE_STORAGE_KEY));

    it('renders a localized accessible close button', () => {
        const fixture = TestBed.createComponent(ArchiveCoverageComponent);
        fixture.detectChanges();
        const button: HTMLButtonElement = fixture.nativeElement.querySelector('.archive-coverage-close');
        expect(button.type).toBe('button');
        expect(button.getAttribute('aria-label')).toBe('Close');
        expect(fixture.nativeElement.textContent).toContain('Nov 16, 2026');
    });

    it('dismisses every mounted instance and stays hidden on remount', () => {
        const first = TestBed.createComponent(ArchiveCoverageComponent);
        const second = TestBed.createComponent(ArchiveCoverageComponent);
        first.detectChanges(); second.detectChanges();
        first.nativeElement.querySelector('button').click();
        first.detectChanges(); second.detectChanges();
        expect(first.nativeElement.querySelector('[role="note"]')).toBeNull();
        expect(second.nativeElement.querySelector('[role="note"]')).toBeNull();
        const remounted = TestBed.createComponent(ArchiveCoverageComponent);
        remounted.detectChanges();
        expect(remounted.nativeElement.querySelector('[role="note"]')).toBeNull();
    });

    it('does not show an empty note or close button without scoped coverage', () => {
        coverageSource.next(null);
        const fixture = TestBed.createComponent(ArchiveCoverageComponent);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('button')).toBeNull();
        expect(fixture.nativeElement.querySelector('[role="note"]')).toBeNull();
    });
});
