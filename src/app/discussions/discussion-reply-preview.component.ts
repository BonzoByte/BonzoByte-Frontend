import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DiscussionReply } from '../core/services/discussions.service';

let quoteSequence = 0;
/** Presentation only: no copied draft text, network request, or read acknowledgement. */
@Component({ selector: 'app-discussion-reply-preview', standalone: true, imports: [CommonModule, TranslateModule],
    template: `<aside *ngIf="context" class="reply-preview">
      <p class="reply-heading">{{ 'discussions.replyContext' | translate:{name: context.authorName || ('discussions.removedUser' | translate)} }}</p>
      <blockquote *ngIf="context.body" #quote [id]="quoteId" [class.expanded]="expanded()">{{ context.body }}</blockquote>
      <p *ngIf="context.body === null" class="quote-unavailable">{{ 'discussions.quoteUnavailable' | translate }}</p>
      <button *ngIf="canExpand() || expanded()" type="button" class="quote-toggle" [attr.aria-expanded]="expanded()"
        [attr.aria-controls]="quoteId" (click)="toggle()">{{ (expanded() ? 'discussions.quoteLess' : 'discussions.quoteMore') | translate }}</button>
    </aside>`,
    styles: [`:host{display:block;min-width:0;max-width:100%;}.reply-preview{box-sizing:border-box;min-width:0;max-width:100%;border:1px solid var(--bb-border,#526071);border-left:3px solid var(--bb-theme-accent,#80d5ff);border-radius:5px;padding:7px 9px;margin:.6rem 0;background:var(--bb-surface-2,#202b34);}
      .reply-heading,.quote-unavailable{font-size:.8rem;color:var(--bb-text-muted,#aab5c0);margin:0;overflow-wrap:anywhere;white-space:normal;}
      blockquote{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;max-height:2.8em;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.4;font-size:.85rem;color:var(--bb-text);margin:5px 0 0;}
      blockquote.expanded{display:block;-webkit-line-clamp:unset;line-clamp:unset;max-height:none;}
      .quote-unavailable{margin-top:4px;}.quote-toggle{background:transparent;border:0;border-radius:3px;color:var(--bb-theme-accent,#80d5ff);padding:4px 0;margin-top:3px;min-height:28px;font:inherit;font-size:.8rem;text-decoration:underline;text-underline-offset:3px;cursor:pointer;white-space:normal;}
      .quote-toggle:focus-visible{outline:2px solid var(--bb-theme-accent,#80d5ff);outline-offset:2px;}`] })
export class DiscussionReplyPreviewComponent implements OnChanges, OnDestroy {
    @Input() context: DiscussionReply | null = null;
    readonly quoteId = `discussion-quote-${++quoteSequence}`;
    readonly expanded = signal(false);
    readonly canExpand = signal(false);
    private element?: HTMLElement;
    private observer?: ResizeObserver;
    private sourceId?: string;
    private sourceBody?: string | null;
    private destroyed = false;
    @ViewChild('quote') set quote(ref: ElementRef<HTMLElement> | undefined) {
        this.observer?.disconnect(); this.element = ref?.nativeElement;
        if (this.element) {
            this.observer = new ResizeObserver(() => this.measure()); this.observer.observe(this.element);
            queueMicrotask(() => this.measure());
        }
    }
    ngOnChanges(): void {
        if (this.sourceId === this.context?.id && this.sourceBody === this.context?.body) return;
        this.sourceId = this.context?.id; this.sourceBody = this.context?.body;
        this.expanded.set(false); this.canExpand.set(false); queueMicrotask(() => this.measure());
    }
    toggle(): void { this.expanded.update(value => !value); queueMicrotask(() => this.measure()); }
    private measure(): void {
        if (!this.destroyed && !this.expanded() && this.element?.isConnected)
            this.canExpand.set(this.element.scrollHeight > this.element.clientHeight + 1);
    }
    ngOnDestroy(): void { this.destroyed = true; this.observer?.disconnect(); this.element = undefined; }
}
