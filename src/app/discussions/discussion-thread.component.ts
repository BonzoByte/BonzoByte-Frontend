import { CommonModule } from '@angular/common';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { MessageAutosizeDirective } from '../shared/directives/message-autosize.directive';
import { DraftUnloadDirective } from '../shared/directives/draft-unload.directive';
import { MessageDayDividerComponent } from '../shared/ui/message-day-divider/message-day-divider.component';
import { InitialsAvatarComponent } from '../shared/ui/initials-avatar/initials-avatar.component';
import { ManualCopyComponent } from '../shared/ui/manual-copy/manual-copy.component';
import { UserPresenceComponent } from '../shared/ui/user-presence/user-presence.component';
import { CommentLinkTarget, parseCommentLinkTarget } from '../core/helpers/comment-link';
import { CommentLinkCopyService } from './comment-link-copy.service';
import { SubmitShortcutDirective } from '../shared/directives/submit-shortcut.directive';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, QueryList, ViewChild, ViewChildren, effect, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { DiscussionComment, DiscussionReply } from '../core/services/discussions.service';
import { DISCUSSION_CODE_UNITS_PER_CHARACTER, discussionTextLength, discussionLengthValid, discussionSelection } from '../core/helpers/discussion-text';
import { DiscussionReplyPreviewComponent } from './discussion-reply-preview.component';
import { PrivateMessagesService } from '../core/services/private-messages.service';
import { RegionalSettingsService } from '../core/services/regional-settings.service';
import { DiscussionState } from './discussion-state';
import { DiscussionDraftsService } from '../core/services/discussion-drafts.service';
import { DiscussionDraftUndoService } from '../core/services/discussion-draft-undo.service';
import { DiscussionLoadingComponent } from './discussion-loading.component';

let discussionFormId = 0;

@Component({ selector: 'app-discussion-thread', standalone: true,
    imports: [CommonModule, FormsModule, TranslateModule, SubmitShortcutDirective, CdkTextareaAutosize, MessageAutosizeDirective, DraftUnloadDirective, DiscussionReplyPreviewComponent, DiscussionLoadingComponent, MessageDayDividerComponent, InitialsAvatarComponent, ManualCopyComponent, UserPresenceComponent], providers: [DiscussionState, CommentLinkCopyService],
    templateUrl: './discussion-thread.component.html', styleUrls: ['./discussion-thread.component.scss'] })
export class DiscussionThreadComponent implements OnChanges, AfterViewInit, OnDestroy {
    @Input({ required: true }) matchTPId!: number;
    @Input() commentTarget: CommentLinkTarget | null = null;
    @Output() requestLogin = new EventEmitter<void>();
    @ViewChildren('commentRow') rows!: QueryList<ElementRef<HTMLElement>>;
    @ViewChild('composer') composer?: ElementRef<HTMLTextAreaElement>;
    readonly formId = `discussion-form-${++discussionFormId}`;
    readonly emojis = [
        { value: '🙂', label: 'smile' }, { value: '😄', label: 'happy' }, { value: '😉', label: 'wink' },
        { value: '🤔', label: 'thinking' }, { value: '👍', label: 'thumbsUp' }, { value: '👏', label: 'applause' },
        { value: '🎾', label: 'tennis' },
    ];
    emojiLimitReached = false;
    body = '';
    restoredDraft = false;
    reply: { id: string; authorName: string } | null = null;
    confirm: { comment: DiscussionComment; action: 'delete' | 'hide' | 'report' } | null = null;
    reason = '';
    private readonly failedAvatars = new Set<string>();
    private observer?: IntersectionObserver;
    private rowSubscription?: Subscription;
    private readonly postSubscription: Subscription;
    private readonly draftRestoredSubscription: Subscription;
    private draftScope?: { actor: string; matchTPId: number };
    readonly highlighted = signal<ReadonlySet<string>>(new Set());
    readonly linkedCommentId = signal<string | null>(null);
    readonly linkedCommentUnavailable = signal(false);
    private linkedTimer?: ReturnType<typeof setTimeout>;
    private linkedPending = false;
    private readonly highlightedOnce = new Set<string>();
    private readonly highlightTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private pendingNewJump = false;
    private viewGeneration = 0;
    private readonly observe = () => {
        this.observer?.disconnect();
        if (this.state.api.visible) this.rows?.forEach(row => this.observer?.observe(row.nativeElement));
        else this.pendingNewJump = false;
        if (this.state.api.visible && this.linkedPending && !this.state.loading()) {
            if (!this.state.loaded() && !this.state.error()) this.state.load();
            else this.queueLinkedScroll();
        }
    };
    readonly trackComment = (_: number, comment: DiscussionComment) => comment.id;
    readonly maxBodyCodeUnits = 1000 * DISCUSSION_CODE_UNITS_PER_CHARACTER;
    readonly maxReasonCodeUnits = 500 * DISCUSSION_CODE_UNITS_PER_CHARACTER;
    private measuredBody = { text: '', count: 0 };
    get bodyLength(): number {
        if (this.measuredBody.text !== this.body) this.measuredBody = { text: this.body, count: discussionTextLength(this.body) };
        return this.measuredBody.count;
    }
    get bodyWithinLimit(): boolean { return this.body.length <= this.maxBodyCodeUnits && this.bodyLength <= 1000; }
    get reasonWithinLimit(): boolean { return discussionLengthValid(this.reason, 500); }
    get bodyRemaining(): number { return Math.max(0, 1000 - this.bodyLength); }
    get reasonRemaining(): number { return Math.max(0, 500 - discussionTextLength(this.reason)); }
    get hasDraft(): boolean { return !!this.body.trim() && this.bodyWithinLimit; }
    get replyPreview(): DiscussionReply | null {
        if (!this.reply) return null;
        const source = this.state.comments().find(comment => comment.id === this.reply!.id);
        if (source) return { id: source.id, authorName: source.deleted || source.hidden ? null : source.author?.nickname || null,
            body: source.deleted || source.hidden ? null : source.body };
        return this.state.comments().find(comment => comment.replyTo?.id === this.reply!.id)?.replyTo ?? this.reply;
    }
    get canUndoDraft(): boolean {
        return !!this.draftScope && !this.body.length && !this.reply && !this.state.busy()
            && this.undo.available(this.draftScope.actor, this.draftScope.matchTPId);
    }
    constructor(readonly state: DiscussionState, readonly regional: RegionalSettingsService, private drafts: DiscussionDraftsService,
        private undo: DiscussionDraftUndoService, readonly privateMessages: PrivateMessagesService, readonly commentLinks: CommentLinkCopyService) {
        this.draftRestoredSubscription = drafts.restored.subscribe(token => {
            if (!this.draftScope || this.draftScope.actor !== token.actor || this.draftScope.matchTPId !== token.matchTPId
                || this.body.length || this.reply || this.state.busy()) return;
            const draft = drafts.read(token.actor, token.matchTPId); if (!draft) return;
            this.body = draft.body; this.reply = draft.reply; this.restoredDraft = true; this.emojiLimitReached = false;
            const input = this.composer?.nativeElement;
            if (input && state.api.document.activeElement === input) {
                input.value = this.body; input.setSelectionRange(this.body.length, this.body.length);
            }
        });
        this.postSubscription = state.postConfirmed.subscribe(post => {
            const scope = this.draftScope;
            if (!scope || scope.matchTPId !== post.matchTPId) return;
            this.drafts.confirmed(scope.actor, post.matchTPId, post.body, post.replyToId, post.clientRequestId);
            if (this.body.trim() === post.body && this.reply?.id === post.replyToId) {
                this.body = ''; this.reply = null; this.restoredDraft = false; this.emojiLimitReached = false;
                this.confirm = null; this.reason = ''; this.failedAvatars.clear();
            }
        });
        effect(() => {
            state.reset();
            untracked(() => {
                this.clearNewPresentation();
                this.linkedPending = !!parseCommentLinkTarget(this.commentTarget?.id, this.commentTarget?.sequence);
                const selected = state.api.selected();
                this.commentLinks.reset(this.matchTPId, selected?.matchTPId === this.matchTPId ? selected.match?.matchId : null);
                const actor = state.api.user()?._id || '';
                this.draftScope = { actor, matchTPId: this.matchTPId };
                const draft = this.drafts.read(actor, this.matchTPId);
                this.body = draft?.body ?? ''; this.reply = draft?.reply ?? null; this.restoredDraft = !!draft;
                this.confirm = null; this.reason = ''; this.failedAvatars.clear(); this.emojiLimitReached = false;
            });
        });
        effect(() => {
            const loading = state.loading(), error = state.error(); state.comments();
            untracked(() => {
                if (error) this.pendingNewJump = false;
                else if (!loading) {
                    if (this.pendingNewJump) this.queueNewScroll();
                    if (this.linkedPending) this.queueLinkedScroll();
                }
                const linked = this.linkedCommentId(), comment = linked ? state.comments().find(row => row.id === linked) : null;
                if (comment?.hidden || comment?.deleted) { this.linkedCommentId.set(null); this.linkedCommentUnavailable.set(true); }
            });
        });
    }
    ngOnChanges(): void {
        const target = parseCommentLinkTarget(this.commentTarget?.id, this.commentTarget?.sequence);
        this.state.open(this.matchTPId, target ? target.sequence - 1 : 0);
    }
    canCopyComment(comment: DiscussionComment): boolean {
        return !comment.deleted && !comment.hidden && !!parseCommentLinkTarget(comment.id, comment.sequence);
    }
    copyComment(comment: DiscussionComment): void {
        if (!this.canCopyComment(comment)) return;
        this.commentLinks.copy(comment, () => this.state.comments().some(row => row.id === comment.id
            && row.sequence === comment.sequence && this.canCopyComment(row)));
    }
    private rememberDraft(clearEmpty = false): void {
        if (this.draftScope && (this.body.trim() || clearEmpty))
            this.drafts.save(this.draftScope.actor, this.draftScope.matchTPId, this.body, this.reply);
    }
    bodyChanged(body: string): void {
        this.body = body; this.emojiLimitReached = false; this.restoredDraft = false; this.rememberDraft(true);
    }
    cancelReply(): void { this.invalidateUndo(); this.reply = null; this.rememberDraft(); }
    private invalidateUndo(): void {
        if (this.draftScope) this.drafts.edited(this.draftScope.actor, this.draftScope.matchTPId);
    }
    undoDraftShortcut(event: KeyboardEvent): void {
        if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.shiftKey
            || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || !this.canUndoDraft || !this.draftScope) return;
        if (this.undo.restore(this.draftScope.actor, this.draftScope.matchTPId)) { event.preventDefault(); event.stopPropagation(); }
    }
    discardDraft(): void {
        if (this.state.busy() || !this.draftScope) return;
        this.undo.discard(this.draftScope.actor, this.draftScope.matchTPId, this.body, this.reply); this.state.discardPostRetry();
        this.body = ''; this.reply = null; this.restoredDraft = false; this.emojiLimitReached = false;
        this.composer?.nativeElement.focus();
    }
    avatar(comment: DiscussionComment): string | null {
        if (comment.deleted || comment.hidden || !comment.author) return null;
        const url = comment.author.avatarUrl;
        if (!url || this.failedAvatars.has(url) || /[<>@\s\\]/u.test(url)) return null;
        if (/^\/uploads\/[A-Za-z0-9/_.,-]+$/.test(url)) return url;
        try {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : null;
        } catch { return null; }
    }
    avatarFailed(comment: DiscussionComment): void {
        if (comment.author?.avatarUrl) this.failedAvatars.add(comment.author.avatarUrl);
    }
    ngAfterViewInit(): void {
        this.observer = new IntersectionObserver(entries => {
            const heading = this.rows?.first?.nativeElement.closest('.bb-modal--discussion')?.querySelector<HTMLElement>('.bb-modal-heading');
            const coveredUntil = heading && getComputedStyle(heading).position === 'sticky' ? heading.getBoundingClientRect().bottom : -Infinity;
            for (const entry of entries) {
                const row = entry.target as HTMLElement, id = row.dataset['commentId'];
                if (!id || !row.isConnected || !this.state.api.visible || !entry.isIntersecting || entry.intersectionRatio <= 0
                    || entry.intersectionRect.width <= 0) continue;
                const shownHeight = coveredUntil === -Infinity ? entry.intersectionRect.height
                    : Math.max(0, entry.intersectionRect.bottom - Math.max(entry.intersectionRect.top, coveredUntil));
                if (!Number.isFinite(shownHeight) || shownHeight < Math.min(160, Math.max(1, entry.boundingClientRect.height / 2))) continue;
                this.state.visibleComment(id);
                const comment = this.state.comments().find(comment => comment.id === id);
                if (comment && this.state.isNewComment(comment) && !this.highlightedOnce.has(id)) {
                    this.highlightedOnce.add(id); this.highlighted.update(ids => new Set([...ids, id]));
                    this.highlightTimers.set(id, setTimeout(() => {
                        this.highlighted.update(ids => { const next = new Set(ids); next.delete(id); return next; });
                        this.highlightTimers.delete(id);
                    }, 6000));
                }
            }
        }, { threshold: [0, 0.01, 0.05, 0.1, 0.25, 0.5, 1] });
        this.rowSubscription = this.rows.changes.subscribe(this.observe); this.observe();
        this.state.api.document.addEventListener('visibilitychange', this.observe);
    }
    jumpToNew(): void {
        if (!this.state.canJumpNew() || this.state.loading() || this.state.busy()) return;
        this.pendingNewJump = true;
        if (this.state.firstNewId()) this.queueNewScroll(); else this.state.loadNew();
    }
    showEarlier(): void { this.pendingNewJump = false; this.state.loadEarlier(); }
    private queueNewScroll(): void {
        const generation = this.viewGeneration;
        queueMicrotask(() => {
            if (!this.pendingNewJump || generation !== this.viewGeneration) return;
            if (!this.state.api.visible || this.state.loading() || this.state.error()) { this.pendingNewJump = false; return; }
            const id = this.state.firstNewId(), row = this.rows?.find(item => item.nativeElement.dataset['commentId'] === id)
                ?? (this.state.rangeAfter() > 0 ? this.rows?.first : undefined);
            this.pendingNewJump = false;
            if (row?.nativeElement.isConnected) {
                row.nativeElement.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
                row.nativeElement.focus({ preventScroll: true });
            }
        });
    }
    private clearNewPresentation(): void {
        this.viewGeneration++; this.pendingNewJump = false;
        clearTimeout(this.linkedTimer); this.linkedCommentId.set(null); this.linkedCommentUnavailable.set(false); this.linkedPending = false;
        for (const timer of this.highlightTimers.values()) clearTimeout(timer);
        this.highlightTimers.clear(); this.highlightedOnce.clear(); this.highlighted.set(new Set());
    }
    private queueLinkedScroll(): void {
        const generation = this.viewGeneration;
        queueMicrotask(() => {
            if (generation !== this.viewGeneration || !this.linkedPending || !this.rows || this.state.loading()
                || !this.state.loaded() || this.state.error() || !this.state.api.visible) return;
            const target = parseCommentLinkTarget(this.commentTarget?.id, this.commentTarget?.sequence);
            const comment = target ? this.state.comments().find(row => row.id === target.id && row.sequence === target.sequence) : null;
            const element = comment ? this.rows.find(row => row.nativeElement.dataset['commentId'] === comment.id)?.nativeElement : null;
            this.linkedPending = false;
            if (!comment || !element?.isConnected || comment.deleted || comment.hidden) { this.linkedCommentUnavailable.set(true); return; }
            this.linkedCommentId.set(comment.id);
            element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
            element.focus({ preventScroll: true });
            clearTimeout(this.linkedTimer);
            this.linkedTimer = setTimeout(() => this.linkedCommentId.set(null), 6000);
        });
    }
    replyTo(comment: DiscussionComment): void {
        this.invalidateUndo();
        // Backend supports a single reply level. Replies to replies keep the root context.
        this.reply = comment.replyTo ? { id: comment.replyTo.id, authorName: comment.replyTo.authorName || '' }
            : { id: comment.id, authorName: comment.author?.nickname || '' };
        this.rememberDraft();
        this.composer?.nativeElement.focus();
    }
    submit(): void {
        if (!this.draftScope || this.state.busy() || this.state.loading() || this.state.error()) return;
        const requestId = this.drafts.beginSubmission(this.draftScope.actor, this.draftScope.matchTPId, this.body, this.reply);
        if (requestId) this.state.submit(this.body, this.reply?.id, requestId);
    }
    retryMutation(): void {
        if (this.state.retryingPost) this.submit(); else this.state.retryMutation();
    }
    insertEmoji(emoji: string): void {
        const input = this.composer?.nativeElement;
        if (!input || !this.state.api.canCompose || this.state.busy() || !this.emojis.some(item => item.value === emoji)) return;
        const [start, end] = discussionSelection(this.body, input.selectionStart, input.selectionEnd);
        const next = this.body.slice(0, start) + emoji + this.body.slice(end);
        if (!discussionLengthValid(next)) {
            this.emojiLimitReached = true;
            return;
        }
        this.emojiLimitReached = false;
        this.body = next;
        this.restoredDraft = false; this.rememberDraft();
        input.value = next;
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
    }
    perform(): void {
        if (!this.confirm) return;
        const { comment, action } = this.confirm;
        if (action === 'delete') this.state.delete(comment);
        if (action === 'hide') this.state.hide(comment);
        if (action === 'report') this.state.report(comment, this.reason);
        this.confirm = null; this.reason = '';
    }
    ngOnDestroy(): void {
        this.clearNewPresentation();
        this.postSubscription.unsubscribe(); this.draftRestoredSubscription.unsubscribe();
        this.observer?.disconnect(); this.rowSubscription?.unsubscribe();
        this.state.api.document.removeEventListener('visibilitychange', this.observe);
    }
}
