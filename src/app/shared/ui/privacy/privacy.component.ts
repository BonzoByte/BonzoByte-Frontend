import { CommonModule } from '@angular/common';
import { Component, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PrivacyConsentService } from '../../../core/services/privacy-consent.service';
import { BbModalShellComponent } from '../bb-modal-shell.component/bb-modal-shell.component';
import en from '../../../../assets/i18n/en.json';
import hr from '../../../../assets/i18n/hr.json';

@Component({ selector: 'app-privacy', standalone: true,
    imports: [CommonModule, FormsModule, TranslateModule, BbModalShellComponent],
    templateUrl: './privacy.component.html', styleUrls: ['./privacy.component.scss'] })
export class PrivacyComponent {
    analytics = false;
    popularity = false;
    constructor(readonly privacy: PrivacyConsentService, private readonly translate: TranslateService) {
        effect(() => { if (privacy.settingsOpen()) this.loadChoices(); });
    }
    // Other dictionaries still contain the former GA-only notice. Use the reviewed
    // English fallback for this entire panel until their new-purpose copy is ready.
    get copy(): typeof en.privacy { return this.translate.currentLang === 'hr' ? hr.privacy : en.privacy; }
    open(): void { this.privacy.open(); this.loadChoices(); }
    acceptAll(): void { this.privacy.save(true, true); }
    rejectAll(): void { this.privacy.save(false, false); }
    saveChoices(): void { this.privacy.save(this.analytics, this.popularity); }
    save(): void { this.saveChoices(); }
    private loadChoices(): void {
        const choice = this.privacy.choice();
        this.analytics = choice?.analytics ?? false;
        this.popularity = choice?.popularity ?? false;
    }
}
