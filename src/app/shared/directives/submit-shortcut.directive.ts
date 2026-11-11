import { Directive, EventEmitter, HostListener, Input, Output } from '@angular/core';

/** An explicit send shortcut; ordinary Enter, IME composition and repeats never submit. */
@Directive({ selector: '[appSubmitShortcut]', standalone: true,
    host: { 'aria-keyshortcuts': 'Control+Enter Meta+Enter' } })
export class SubmitShortcutDirective {
    @Input() submitShortcutDisabled = false;
    @Output() submitShortcut = new EventEmitter<void>();

    @HostListener('keydown', ['$event'])
    onKeydown(event: KeyboardEvent): void {
        if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing || event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat && !this.submitShortcutDisabled) this.submitShortcut.emit();
    }
}
