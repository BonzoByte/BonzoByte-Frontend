export const DISCUSSION_COMMENT_LIMIT = 1000;
export const DISCUSSION_CODE_UNITS_PER_CHARACTER = 32;
// Graphemes count visible characters, including skin tones, flags and ZWJ emoji.
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
export function discussionTextLength(text: string): number {
    let count = 0;
    for (const _ of segmenter.segment(text)) count++;
    return count;
}
export function discussionLengthValid(text: string, limit = DISCUSSION_COMMENT_LIMIT): boolean {
    return text.length <= limit * DISCUSSION_CODE_UNITS_PER_CHARACTER && discussionTextLength(text) <= limit;
}
/** DOM selections use UTF-16 offsets; never insert into half a visible character. */
export function discussionSelection(text: string, start: number, end: number): [number, number] {
    start = Math.max(0, Math.min(start, text.length)); end = Math.max(start, Math.min(end, text.length));
    const caret = start === end;
    for (const part of segmenter.segment(text)) {
        const next = part.index + part.segment.length;
        if (start > part.index && start < next) start = caret ? next : part.index;
        if (end > part.index && end < next) end = next;
    }
    return [start, end];
}
