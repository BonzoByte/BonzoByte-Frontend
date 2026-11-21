import { Component, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PUBLIC_INFO_EMAIL } from '../../../core/config/contact';
import { PrivacyConsentService } from '../../../core/services/privacy-consent.service';
import en from '../../../../assets/i18n/en.json';
import hr from '../../../../assets/i18n/hr.json';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.scss',
})
export class PrivacyPolicyComponent {
  protected readonly privacy = inject(PrivacyConsentService);
  protected readonly contactEmail = PUBLIC_INFO_EMAIL;
  private readonly translate = inject(TranslateService);

  // Use the same reviewed, whole-notice language fallback as the settings panel.
  protected get copy(): typeof en.privacy {
    return this.translate.currentLang === 'hr' ? hr.privacy : en.privacy;
  }
}
