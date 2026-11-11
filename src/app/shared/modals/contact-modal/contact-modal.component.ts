import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { MessageAutosizeDirective } from '../../directives/message-autosize.directive';
import { DraftUnloadDirective } from '../../directives/draft-unload.directive';
import { Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { LocalizedSnackbarService } from '@app/core/i18n/localized-snackbar.service';
import { finalize, takeUntil } from 'rxjs/operators';
import { Subject, Subscription } from 'rxjs';
import { environment } from '@env/environment';
import { PUBLIC_CONTACT_EMAIL } from '@app/core/config/contact';
import { BbModalShellComponent } from "@app/shared/ui/bb-modal-shell.component/bb-modal-shell.component";
import { CopyContactEmailComponent } from '../../ui/copy-contact-email/copy-contact-email.component';
import { SubmitShortcutDirective } from '../../directives/submit-shortcut.directive';
import { ContactDraft, ContactDraftService } from '@app/core/services/contact-draft.service';

@Component({
    selector: 'app-contact-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatSnackBarModule, BbModalShellComponent, TranslateModule, CopyContactEmailComponent, SubmitShortcutDirective, CdkTextareaAutosize, MessageAutosizeDirective, DraftUnloadDirective],
    templateUrl: './contact-modal.component.html',
    encapsulation: ViewEncapsulation.None
})
export class ContactModalComponent implements OnDestroy {
    readonly contactEmail = PUBLIC_CONTACT_EMAIL;
    readonly minimumMessageLength = 10;
    @Output() closed = new EventEmitter<void>();

    form: FormGroup;
    submitting = false;
    submitted = false;
    confirmDiscard = false;
    private draftScope: number;
    private readonly subscriptions = new Subscription();
    private readonly destroyed = new Subject<void>();
    @ViewChild('keepWritingButton') private keepWritingButton?: ElementRef<HTMLButtonElement>;
    @ViewChild('nameField') private nameField?: ElementRef<HTMLInputElement>;
    @ViewChild('emailField') private emailField?: ElementRef<HTMLInputElement>;
    @ViewChild('messageField') private messageField?: ElementRef<HTMLTextAreaElement>;

    constructor(
        private fb: FormBuilder,
        private snack: LocalizedSnackbarService,
        private http: HttpClient,
        private drafts: ContactDraftService
    ) {
        this.draftScope = this.drafts.scopeVersion;
        const draft = this.drafts.read();
        this.form = this.fb.group({
            name: [draft?.name ?? '', Validators.required],
            email: [draft?.email ?? '', [Validators.required, Validators.email]],
            message: [draft?.message ?? '', [Validators.required, Validators.minLength(this.minimumMessageLength)]],
        });
        this.subscriptions.add(this.form.valueChanges.subscribe(value => this.drafts.save(value, this.draftScope)));
        this.subscriptions.add(this.drafts.scopeChanged.subscribe(() => {
            this.draftScope = this.drafts.scopeVersion;
            this.form.reset(undefined, { emitEvent: false }); this.submitted = this.confirmDiscard = false;
        }));
    }

    get name() { return this.form.get('name'); }
    get email() { return this.form.get('email'); }
    get message() { return this.form.get('message'); }
    // Match Angular's existing string-length validator; do not truncate the draft.
    get messageLength(): number { return typeof this.message?.value === 'string' ? this.message.value.length : 0; }
    get hasDraft(): boolean { return Object.values(this.form.value).some(value => typeof value === 'string' && value.length > 0); }

    close(): void {
        if (this.submitting) return;
        if (this.confirmDiscard) { this.keepWriting(); return; }
        this.drafts.save(this.form.value, this.draftScope);
        this.closed.emit();
    }

    requestDiscard(): void {
        if (this.submitting || !this.hasDraft) return;
        this.confirmDiscard = true;
        setTimeout(() => this.keepWritingButton?.nativeElement.focus());
    }

    keepWriting(): void {
        this.confirmDiscard = false;
        setTimeout(() => this.messageField?.nativeElement.focus());
    }
    discard(): void {
        if (this.submitting || !this.confirmDiscard) return;
        this.drafts.clear(this.draftScope);
        this.form.reset(undefined, { emitEvent: false }); this.confirmDiscard = false; this.closed.emit();
    }

    submit(): void {
        this.submitted = true;

        if (this.submitting || this.confirmDiscard) return;

        this.form.markAllAsTouched();
        if (this.form.invalid) {
            const fields = [[this.name, this.nameField], [this.email, this.emailField], [this.message, this.messageField]] as const;
            fields.find(([control]) => control?.invalid)?.[1]?.nativeElement.focus();
            return;
        }

        this.submitting = true;

        const payload: ContactDraft = { ...this.form.value };
        const scope = this.draftScope;
        this.http.post(`${environment.apiUrl}/auth/contact`, payload)
            .pipe(takeUntil(this.destroyed), takeUntil(this.drafts.scopeChanged), finalize(() => (this.submitting = false)))
            .subscribe({
                next: () => {
                    this.snack.open('contact.sent', '', {
                        duration: 3000,
                        panelClass: 'success-snackbar'
                    });
                    this.drafts.confirmed(payload, scope);
                    this.form.reset(undefined, { emitEvent: false });
                    this.submitted = false;
                    this.confirmDiscard = false;
                    this.closed.emit();
                },
                error: (err) => {
                    this.snack.open(
                        err?.status === 0 ? 'auth.networkError' : err?.status === 429 ? 'auth.tooManyRequests' : 'contact.failed',
                        '',
                        {
                            duration: 4000,
                            panelClass: 'error-snackbar'
                        }
                    );
                }
            });
    }

    ngOnDestroy(): void {
        this.destroyed.next(); this.destroyed.complete(); this.subscriptions.unsubscribe();
    }
}
