import { CommonModule } from '@angular/common';
import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Inject, NgZone, OnDestroy, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { TranslateModule } from '@ngx-translate/core';
import { ContactModalComponent } from '../../modals/contact-modal/contact-modal.component';
import { BbModalShellComponent } from "@app/shared/ui/bb-modal-shell.component/bb-modal-shell.component";
import { PrivacyConsentService } from '../../../core/services/privacy-consent.service';
import { PUBLIC_INFO_EMAIL } from '../../../core/config/contact';
import { CopyContactEmailComponent } from '../copy-contact-email/copy-contact-email.component';

@Component({
    selector: 'app-footer',
    standalone: true,
    imports: [CommonModule, TranslateModule, ContactModalComponent, BbModalShellComponent, A11yModule, CopyContactEmailComponent],
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements AfterViewInit, OnDestroy {
    private readonly router = inject(Router, { optional: true });
    openTennisBreak(event: MouseEvent): void {
        if (!this.router || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        void this.router.navigateByUrl('/tennis-break');
    }
    readonly contactEmail = PUBLIC_INFO_EMAIL;
    constructor(readonly privacy: PrivacyConsentService, @Inject(DOCUMENT) private document: Document, private zone: NgZone) {}
    @ViewChild('footerBar', { static: true }) private footerBar!: ElementRef<HTMLElement>;
    private resizeObserver?: ResizeObserver;
    private previousFooterHeight = '';
    openPrivacy(): void { this.showAbout = this.showContact = this.showResponsible = false; this.updateBodyLock(); this.privacy.open(); }
    showAbout = false;
    showContact = false;
    showResponsible = false;

    ngAfterViewInit(): void {
        const rootStyle = this.document.documentElement.style;
        this.previousFooterHeight = rootStyle.getPropertyValue('--footer-h');
        // Grids, page padding and the privacy banner share the actual fixed footer height.
        // Do not use this variable as the footer's own minimum height (a resize feedback loop).
        this.zone.runOutsideAngular(() => {
            const measure = () => {
                const height = Math.ceil(this.footerBar.nativeElement.getBoundingClientRect().height);
                if (height > 0) rootStyle.setProperty('--footer-h', `${height}px`);
            };
            measure();
            if (typeof ResizeObserver !== 'undefined') {
                this.resizeObserver = new ResizeObserver(measure);
                this.resizeObserver.observe(this.footerBar.nativeElement);
            }
        });
    }

    private updateBodyLock() {
        const anyOpen = this.showAbout || this.showContact || this.showResponsible;
        this.document.body.classList.toggle('modal-open', anyOpen);
    }

    openAbout() {
        this.showContact = this.showResponsible = false;
        this.showAbout = true;
        this.updateBodyLock();
    }
    openContact() {
        this.showAbout = this.showResponsible = false;
        this.showContact = true;
        this.updateBodyLock();
    }
    closeAbout() {
        this.showAbout = false;
        this.updateBodyLock();
    }
    closeContact() {
        this.showContact = false;
        this.updateBodyLock();
    }
    openResponsible() {
        this.showAbout = this.showContact = false;
        this.showResponsible = true;
        this.updateBodyLock();
    }
    closeResponsible() {
        this.showResponsible = false;
        this.updateBodyLock();
    }

    ngOnDestroy(): void {
        this.resizeObserver?.disconnect();
        const rootStyle = this.document.documentElement.style;
        if (this.previousFooterHeight) rootStyle.setProperty('--footer-h', this.previousFooterHeight);
        else rootStyle.removeProperty('--footer-h');
        // Release the body lock if the component is destroyed while a modal is open.
        this.document.body.classList.remove('modal-open');
    }
}
