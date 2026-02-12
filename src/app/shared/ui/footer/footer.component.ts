import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { ContactModalComponent } from '../../modals/contact-modal/contact-modal.component';
import { TrapFocusDirective } from '../../directives/trap-focus.directive';
import { AccessibleClickDirective } from '../../directives/accessible-click.directive';

@Component({
    selector: 'app-footer',
    standalone: true,
    imports: [CommonModule, ContactModalComponent, TrapFocusDirective, AccessibleClickDirective],
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnDestroy {
    showAbout = false;
    showContact = false;

    private updateBodyLock() {
        const anyOpen = this.showAbout || this.showContact;
        document.body.classList.toggle('modal-open', anyOpen);
    }

    openAbout() {
        this.showContact = false;
        this.showAbout = true;
        this.updateBodyLock();
    }
    openContact() {
        this.showAbout = false;
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

    ngOnDestroy(): void {
        // safety: očisti lock ako se komponenta uništi s otvorenim modalom
        document.body.classList.remove('modal-open');
    }
}