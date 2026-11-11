import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedSnackbarService } from '../../core/i18n/localized-snackbar.service';
import { authErrorKey } from '../../core/i18n/auth-error-key';
import { Component, ElementRef, EventEmitter, Inject, OnDestroy, OnInit, Optional, Output, ViewChild, ViewEncapsulation } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { Observable, of, Subscription } from 'rxjs';
import { catchError, debounceTime, finalize, map, switchMap, take, filter } from 'rxjs/operators';

import { User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import {
    BONZOBYTE_THEMES,
    BonzoByteTheme,
    ThemeService
} from '../../core/services/theme.service';
import { TimeZoneNoticePreferenceService } from '../../core/services/time-zone-notice-preference.service';
import { AdDisplayPreferenceService } from '../../core/services/ad-display-preference.service';
import { RegionalSettingsService } from '../../core/services/regional-settings.service';
import { membershipTier, savedTrialBalance } from '../../core/helpers/membership';
import { PredictionOverviewPreferenceService } from '../../core/services/prediction-overview-preference.service';
import { QuickFilterPreferenceService, QuickFilterPreferences } from '../../core/services/quick-filter-preference.service';
import { AccessibleClickDirective } from '../../shared/directives/accessible-click.directive';
import { AccountAvatarComponent } from '../../shared/ui/account-avatar/account-avatar.component';
import { DraftUnloadGuardService } from '../../core/services/draft-unload-guard.service';
import { BbModalShellComponent } from "@app/shared/ui/bb-modal-shell.component/bb-modal-shell.component";

type ProfileTab = 'account' | 'display' | 'membership';
let nextProfileId = 0;

/** Async validator that checks nickname availability. */
function usernameAvailableValidator(auth: AuthService): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
        const value = (control.value || '').trim();
        if (!value) return of(null);

        const current = auth.getUser()?.nickname;
        if (current && value === current) return of(null);

        return of(value).pipe(
            debounceTime(300),
            switchMap(v => auth.checkNicknameExists(v)),
            map(exists => (exists ? { nicknameTaken: true } : null)),
            catchError(() => of(null))
        );
    };
}

@Component({
    selector: 'app-user-modal',
    standalone: true,
    imports: [TranslateModule, CommonModule, ReactiveFormsModule, MatSnackBarModule, BbModalShellComponent, AccessibleClickDirective, AccountAvatarComponent],
    templateUrl: './user-modal.component.html',
    encapsulation: ViewEncapsulation.None
})
export class UserModalComponent implements OnInit, OnDestroy {
    @Output() closed = new EventEmitter<void>();
    @Output() updated = new EventEmitter<User>();
    @Output() deletionRequested = new EventEmitter<void>();

    userForm!: FormGroup;

    currentUser!: User;
    private membershipSubscription?: Subscription;
    get membershipUser(): User | null { return this.authService.getUser(); }
    get membershipKey(): string { return 'membership.' + membershipTier(this.membershipUser); }
    get savedTrial() { return savedTrialBalance(this.membershipUser, this.authService.membershipNowMs()); }
    get membershipExpiry(): string | null {
        const e = this.membershipUser?.entitlements;
        return e?.membershipEndsAt ?? (e?.hasTrial ? e.trialEndsAt : e?.isPremium ? e.subscriptionEndsAt : null) ?? null;
    }
    isLocalAccount = false;

    selectedFile: File | null = null;
    previewUrl: string | null = null;

    submitted = false;
    confirmDiscard = false;
    readonly tabs = ['account', 'display', 'membership'] as const;
    readonly tabIdPrefix = `bb-profile-${++nextProfileId}`;
    activeTab: ProfileTab = 'account';
    @ViewChild('keepEditingButton') private keepEditingButton?: ElementRef<HTMLButtonElement>;
    @ViewChild('profileForm') private profileForm?: ElementRef<HTMLFormElement>;
    @ViewChild('profileTabs') private profileTabs?: ElementRef<HTMLElement>;
    @ViewChild('profilePanels') private profilePanels?: ElementRef<HTMLElement>;
    private initialDraft?: Record<string, string | boolean>;
    private initialTheme?: BonzoByteTheme;
    private keepThemeOnDestroy = false;
    private pendingCloseAction: 'close' | 'pricing' | 'delete' = 'close';
    private returnFocusId = '';
    private focusTimer?: ReturnType<typeof setTimeout>;
    private avatarReader?: FileReader;
    private validationSubscription?: Subscription;
    private destroyed = false;
    private closing = false;
    private unloadCleanup?: () => void;
    private unloadFormSubscription?: Subscription;

    // banners
    errorMessage = '';

    // states
    isSaving = false;
    isSendingReset = false;
    readonly themes = BONZOBYTE_THEMES;
    selectedTheme: BonzoByteTheme;
    predictionOverviewVisible: boolean;

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private snackBar: LocalizedSnackbarService,
        private themeService: ThemeService,
        private predictionOverviewPreference: PredictionOverviewPreferenceService,
        private quickFilterPreference: QuickFilterPreferenceService,
        private timeZoneNoticePreference: TimeZoneNoticePreferenceService,
        public adDisplayPreference: AdDisplayPreferenceService,
        public regional: RegionalSettingsService,
        @Optional() @Inject(DraftUnloadGuardService) private unloadGuard: DraftUnloadGuardService | null = null
    ) {
        this.selectedTheme = themeService.selectedTheme;
        this.predictionOverviewVisible = predictionOverviewPreference.isVisible;
    }

    ngOnInit(): void {
        const u = this.authService.getUser();
        if (!u) {
      // Close defensively if the modal opens without a user.
            this.errorMessage = 'profile.notLoaded';
            return;
        }

        this.currentUser = u;

        // local/manual account?
        this.isLocalAccount = this.currentUser?.createdVia
            ? this.currentUser.createdVia === 'manual'
            : !this.currentUser?.googleId && !this.currentUser?.facebookId;

        this.userForm = this.fb.group({
            email: [{ value: this.currentUser.email || '', disabled: true }],
            nickname: this.fb.control(
                this.currentUser.nickname || '',
                {
                    validators: [Validators.minLength(3), Validators.maxLength(20)],
                    asyncValidators: [usernameAvailableValidator(this.authService)],
                    updateOn: 'blur'
                }
            ),
            predictionOverviewVisible: [this.predictionOverviewVisible],
            shareSettledPicks: [{ value: this.currentUser.competitionPrivacy?.shareSettledPicks === true,
                disabled: this.currentUser.isVerified !== true && this.currentUser.competitionPrivacy?.shareSettledPicks !== true }],
            showOnlineStatus: [{ value: this.currentUser.presencePrivacy?.showOnlineStatus === true,
                disabled: this.currentUser.isVerified !== true && this.currentUser.presencePrivacy?.showOnlineStatus !== true }],
            timeZoneNoticeVisible: [this.timeZoneNoticePreference.isVisible],
            hideAds: [{ value: this.adDisplayPreference.isHidden(u), disabled: !this.adDisplayPreference.canHide(u) }],
            quickFilterOdds: [this.quickFilterPreference.current.odds],
            quickFilterValue: [this.quickFilterPreference.current.value],
            quickFilterStatus: [this.quickFilterPreference.current.status]
        });

        this.membershipSubscription = this.authService.user$?.subscribe(user => {
            const control = this.userForm.get('hideAds')!;
            if (!this.adDisplayPreference.canHide(user)) {
                control.setValue(false, { emitEvent: false });
                control.disable({ emitEvent: false });
                if (this.initialDraft) this.initialDraft['hideAds'] = false;
            } else if (control.disabled) {
                control.setValue(this.adDisplayPreference.isHidden(user), { emitEvent: false });
                control.enable({ emitEvent: false });
                if (this.initialDraft) this.initialDraft['hideAds'] = control.value === true;
            }
        });
        this.previewUrl = this.currentUser.avatarUrl || null;
        this.initialDraft = this.draftState();
        this.initialTheme = this.selectedTheme;
        this.unloadCleanup = this.unloadGuard?.register(() => {
            if (this.closing || this.destroyed || !this.initialDraft) return false;
            const nickname = this.profileForm?.nativeElement.querySelector<HTMLInputElement>('[formcontrolname="nickname"]')?.value;
            return this.isSaving || this.hasUnsavedChanges || (nickname !== undefined && nickname.trim() !== this.initialDraft['nickname']);
        });
        this.unloadFormSubscription = this.userForm.valueChanges.subscribe(() => this.refreshUnloadGuard());

    // Lock background scrolling while the modal is open.
        document.body.classList.add('modal-open');
    }

    ngOnDestroy(): void {
        this.destroyed = true;
        this.unloadCleanup?.(); this.unloadFormSubscription?.unsubscribe();
        this.validationSubscription?.unsubscribe();
        this.membershipSubscription?.unsubscribe();
        if (this.focusTimer) clearTimeout(this.focusTimer);
        this.avatarReader?.abort();
        if (!this.keepThemeOnDestroy) this.restoreThemePreview();
        document.body.classList.remove('modal-open');
    }

    close(): void {
        if (this.isSaving) return;
        if (this.confirmDiscard) { this.keepEditing(); return; }
        this.requestClose('close');
    }

    selectTab(tab: ProfileTab): void {
        if (this.isSaving || this.confirmDiscard || this.closing || this.destroyed || tab === this.activeTab) return;
        this.captureNicknameDraft();
        this.activeTab = tab;
        if (this.profilePanels) this.profilePanels.nativeElement.scrollTop = 0;
    }

    tabKey(event: KeyboardEvent): void {
        if (event.defaultPrevented || event.isComposing || this.isSaving ||
            !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = this.tabs.indexOf(this.activeTab);
        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1 :
            (index + (event.key === 'ArrowRight' ? 1 : -1) + this.tabs.length) % this.tabs.length;
        const next = this.tabs[nextIndex];
        this.selectTab(next);
        this.profileTabs?.nativeElement.querySelector<HTMLElement>(`#${this.tabIdPrefix}-tab-${next}`)?.focus();
    }

    get hasUnsavedChanges(): boolean {
        if (!this.userForm || !this.initialDraft) return false;
        const current = this.draftState();
        return !!this.selectedFile || this.selectedTheme !== this.initialTheme ||
            Object.keys(current).some(key => current[key] !== this.initialDraft![key]);
    }

    refreshUnloadGuard(): void { this.unloadGuard?.refresh(); }

    private draftState(): Record<string, string | boolean> {
        const state: Record<string, string | boolean> = {
            nickname: String(this.userForm.get('nickname')?.value || '').trim()
        };
        for (const key of ['predictionOverviewVisible', 'shareSettledPicks', 'showOnlineStatus', 'timeZoneNoticeVisible',
            'hideAds', 'quickFilterOdds', 'quickFilterValue', 'quickFilterStatus'])
            state[key] = this.userForm.get(key)?.value === true;
        return state;
    }

    private requestClose(action: 'close' | 'pricing' | 'delete'): void {
        if (this.isSaving || this.confirmDiscard || this.closing || this.destroyed) return;
        this.validationSubscription?.unsubscribe();
        this.captureNicknameDraft();
        this.pendingCloseAction = action;
        if (this.hasUnsavedChanges) {
            this.returnFocusId = document.activeElement?.id || '';
            this.confirmDiscard = true;
            this.focusTimer = setTimeout(() => this.keepEditingButton?.nativeElement.focus());
        } else this.finishClose(action);
    }

    private captureNicknameDraft(): void {
        // updateOn: 'blur' has not committed text when Escape is pressed inside the field.
        const input = this.profileForm?.nativeElement.querySelector<HTMLInputElement>('[formcontrolname="nickname"]');
        const control = this.userForm?.get('nickname');
        if (input && control && input.value !== control.value) {
            control.setValue(input.value, { emitEvent: false });
            control.markAsDirty();
        }
    }

    keepEditing(): void {
        this.confirmDiscard = false;
        this.pendingCloseAction = 'close';
        if (this.focusTimer) clearTimeout(this.focusTimer);
        this.focusTimer = setTimeout(() => {
            const form = this.profileForm?.nativeElement;
            const target = this.returnFocusId ? form?.querySelector<HTMLElement>('#' + CSS.escape(this.returnFocusId)) : null;
            const visibleTarget = target && !target.closest('[hidden]') ? target : null;
            (visibleTarget || form?.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden]) input:not(:disabled), [role="tabpanel"]:not([hidden]) select, [role="tabpanel"]:not([hidden]) button:not(:disabled)') ||
                this.profileTabs?.nativeElement.querySelector<HTMLElement>('[aria-selected="true"]'))?.focus();
        });
    }

    discardChanges(): void {
        if (this.isSaving || !this.confirmDiscard) return;
        const action = this.pendingCloseAction;
        this.restoreThemePreview();
        this.avatarReader?.abort(); this.selectedFile = null;
        this.confirmDiscard = false;
        this.finishClose(action);
    }

    private restoreThemePreview(): void {
        if (this.initialTheme && this.selectedTheme !== this.initialTheme &&
            this.authService.getUser()?._id === this.currentUser?._id && this.themeService.selectedTheme === this.selectedTheme) {
            this.themeService.setTheme(this.initialTheme, false);
            this.selectedTheme = this.initialTheme;
        }
    }

    private savedChanges(): void {
        this.commitThemePreview();
        this.selectedFile = null;
        this.initialDraft = this.draftState(); this.initialTheme = this.selectedTheme;
        this.keepThemeOnDestroy = true;
        this.userForm.markAsPristine();
        this.finishClose('close');
    }

    private commitThemePreview(): void {
        if (this.selectedTheme !== this.initialTheme) this.themeService.setTheme(this.selectedTheme);
        this.initialTheme = this.selectedTheme;
        this.keepThemeOnDestroy = true;
    }

    private finishClose(action: 'close' | 'pricing' | 'delete'): void {
        if (this.closing || this.destroyed) return;
        this.closing = true;
        this.unloadCleanup?.();
        this.validationSubscription?.unsubscribe();
        document.body.classList.remove('modal-open');
        this.closed.emit();
        if (action === 'pricing') window.dispatchEvent(new CustomEvent('openBilling'));
        if (action === 'delete') this.deletionRequested.emit();
    }

    // --------
    // Save
    // --------
    onSubmit(): void {
        this.submitted = true;
        this.errorMessage = '';

        if (this.isSaving || this.confirmDiscard || this.closing || this.destroyed) return;

        this.captureNicknameDraft();

        const nicknameCtrl = this.userForm.get('nickname');

        // Trim the nickname without triggering valueChanges.
        if (nicknameCtrl && typeof nicknameCtrl.value === 'string') {
            const raw = nicknameCtrl.value as string;
            const trimmed = raw.trim();
            if (trimmed !== raw) nicknameCtrl.setValue(trimmed, { emitEvent: false });
        }

        // Force run validators once
        this.userForm.markAllAsTouched();
        this.userForm.updateValueAndValidity({ onlySelf: false, emitEvent: false });

      // Wait once for an asynchronous validator before continuing.
        if (this.userForm.pending) {
            this.validationSubscription?.unsubscribe();
            this.validationSubscription = this.userForm.statusChanges
                .pipe(filter(s => s !== 'PENDING'), take(1))
                .subscribe(() => this.onSubmit());
            return;
        }

        if (this.userForm.invalid) {
            this.errorMessage = 'profile.fixErrors';
            this.activeTab = 'account';
            if (this.focusTimer) clearTimeout(this.focusTimer);
            this.focusTimer = setTimeout(() => this.profileForm?.nativeElement.querySelector<HTMLElement>('[formcontrolname="nickname"]')?.focus());
            return;
        }

        const requestedPredictionOverviewVisibility =
            !!this.userForm.get('predictionOverviewVisible')?.value;
        const predictionOverviewChanged =
            requestedPredictionOverviewVisibility !== this.predictionOverviewPreference.isVisible;
        const requestedTimeZoneNoticeVisibility = !!this.userForm.get('timeZoneNoticeVisible')?.value;
        const timeZoneNoticeChanged = requestedTimeZoneNoticeVisibility !== this.timeZoneNoticePreference.isVisible;
        const requestedHideAds = !!this.userForm.get('hideAds')?.value;
        const requestedQuickFilters: QuickFilterPreferences = {
            odds: !!this.userForm.get('quickFilterOdds')?.value,
            value: !!this.userForm.get('quickFilterValue')?.value,
            status: !!this.userForm.get('quickFilterStatus')?.value
        };
        const currentQuickFilters = this.quickFilterPreference.current;
        const quickFiltersChanged =
            requestedQuickFilters.odds !== currentQuickFilters.odds ||
            requestedQuickFilters.value !== currentQuickFilters.value ||
            requestedQuickFilters.status !== currentQuickFilters.status;
        const currentNickname = (this.currentUser.nickname || '').trim();
        const requestedNickname = (this.userForm.get('nickname')?.value || '').trim();
        const requestedSharing = this.userForm.get('shareSettledPicks')?.value === true;
        const sharingChanged = requestedSharing !== (this.currentUser.competitionPrivacy?.shareSettledPicks === true);
        const requestedOnline = this.userForm.get('showOnlineStatus')?.value === true;
        const onlineChanged = requestedOnline !== (this.currentUser.presencePrivacy?.showOnlineStatus === true);
        const profileChanged = requestedNickname !== currentNickname || !!this.selectedFile || sharingChanged || onlineChanged;

        if (!profileChanged) {
            if (predictionOverviewChanged) {
                this.predictionOverviewPreference.setVisible(requestedPredictionOverviewVisibility);
                this.predictionOverviewVisible = this.predictionOverviewPreference.isVisible;
            }
            if (quickFiltersChanged) this.quickFilterPreference.set(requestedQuickFilters);
            if (timeZoneNoticeChanged) this.timeZoneNoticePreference.setVisible(requestedTimeZoneNoticeVisibility);
            this.adDisplayPreference.setHidden(this.authService.getUser(), requestedHideAds);

            this.userForm.markAsPristine();
            this.snackBar.open('profile.saved', '', {
                duration: 2000,
                horizontalPosition: 'right',
                verticalPosition: 'bottom',
                panelClass: 'success-snackbar'
            });
            this.savedChanges();
            return;
        }

        const formData = new FormData();
        formData.append('nickname', requestedNickname);
        if (sharingChanged) formData.append('shareSettledPicks', String(requestedSharing));
        if (onlineChanged) formData.append('showOnlineStatus', String(requestedOnline));
        if (this.selectedFile) formData.append('avatar', this.selectedFile);

        this.isSaving = true;

        this.authService.updateUser(formData)
            .pipe(finalize(() => (this.isSaving = false)))
            .subscribe({
                next: (user) => {
                    this.currentUser = user;
                    this.previewUrl = user.avatarUrl || this.previewUrl;

                    if (predictionOverviewChanged) {
                        this.predictionOverviewPreference.setVisible(requestedPredictionOverviewVisibility);
                        this.predictionOverviewVisible = this.predictionOverviewPreference.isVisible;
                    }
                    if (quickFiltersChanged) this.quickFilterPreference.set(requestedQuickFilters);
                    if (timeZoneNoticeChanged) this.timeZoneNoticePreference.setVisible(requestedTimeZoneNoticeVisibility);
                    this.adDisplayPreference.setHidden(this.authService.getUser(), requestedHideAds);

                    this.errorMessage = '';

                    // form is now pristine again
                    this.userForm.markAsPristine();
                    this.selectedFile = null;

                    // notify parent (i eventualno zatvaranje modala)
                    this.commitThemePreview();
                    this.updated.emit(user);

                    // optional: mali snack
                    this.snackBar.open('profile.saved', '', {
                        duration: 2000,
                        horizontalPosition: 'right',
                        verticalPosition: 'bottom',
                        panelClass: 'success-snackbar'
                    });
                    this.savedChanges();
                },
                error: (err) => {
                    const msg = authErrorKey(err, 'profile');
                    this.errorMessage = msg;
                }
            });
    }

    // --------
    // Avatar
    // --------
    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const f = input.files[0];
        const okTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (f.size > 2 * 1024 * 1024) {
            this.errorMessage = 'profile.fileTooLarge';
            this.avatarReader?.abort(); this.previewUrl = this.currentUser.avatarUrl || null;
            this.selectedFile = null;
            input.value = '';
            return;
        }

        if (!okTypes.includes(f.type)) {
            this.errorMessage = 'profile.fileType';
            this.avatarReader?.abort(); this.previewUrl = this.currentUser.avatarUrl || null;
            this.selectedFile = null;
            input.value = '';
            return;
        }

        this.errorMessage = '';

        this.selectedFile = f;

        this.avatarReader?.abort();
        const reader = new FileReader();
        this.avatarReader = reader;
        reader.onload = () => {
            if (this.selectedFile === f && this.avatarReader === reader) this.previewUrl = reader.result as string;
        };
        reader.readAsDataURL(f);

        // enable Save
        this.userForm.markAsDirty();
    }

    changeTheme(theme: string): void {
        const previousTheme = this.selectedTheme;
        this.themeService.setTheme(theme, false);
        this.selectedTheme = this.themeService.selectedTheme;
        if (this.selectedTheme !== previousTheme) this.userForm.markAsDirty();
        this.refreshUnloadGuard();
    }

    restoreDisplayDefaults(): void {
        if (!this.userForm || this.activeTab !== 'display' || this.isSaving || this.confirmDiscard || this.closing || this.destroyed) return;
        // Patch only this tab's draft; never reset the complete form or write preferences here.
        const defaults = {
            predictionOverviewVisible: true,
            timeZoneNoticeVisible: true,
            hideAds: this.adDisplayPreference.canHide(this.membershipUser),
            quickFilterOdds: false,
            quickFilterValue: false,
            quickFilterStatus: false
        };
        if (this.selectedTheme === 'dark' && Object.entries(defaults).every(([key, value]) => this.userForm.get(key)?.value === value)) return;
        // A prior Save waiting on nickname validation must not save this new draft automatically.
        this.validationSubscription?.unsubscribe();
        this.userForm.patchValue(defaults, { emitEvent: false });
        if (this.selectedTheme !== 'dark') this.changeTheme('dark');
        this.userForm.markAsDirty();
        this.refreshUnloadGuard();
    }

    openPricing(): void {
        this.requestClose('pricing');
    }

    requestDeletion(): void { this.requestClose('delete'); }

    // --------
    // Password reset (local accounts)
    // --------
    changePassword(): void {
        const email = this.currentUser?.email || this.userForm.get('email')?.value;
        if (!email || this.isSendingReset) return;

        this.isSendingReset = true;

        this.authService.sendResetPasswordEmail(email)
            .pipe(finalize(() => (this.isSendingReset = false)))
            .subscribe({
                next: () => {
                    this.snackBar.open('auth.resetRequested', '', {
                        duration: 5000,
                        horizontalPosition: 'right',
                        verticalPosition: 'bottom',
                        panelClass: 'success-snackbar'
                    });
                },
                error: (err) => {
                    this.snackBar.open(authErrorKey(err, 'recovery'), '', {
                        duration: 5000,
                        horizontalPosition: 'right',
                        verticalPosition: 'bottom',
                        panelClass: 'error-snackbar'
                    });
                }
            });
    }

    // Getters
    get nickname() { return this.userForm.get('nickname'); }
    get email() { return this.userForm.get('email'); }
}
