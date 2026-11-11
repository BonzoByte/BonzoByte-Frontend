/** Decorative colors only: never use these as account status or verification badges. */
export const INITIALS_AVATAR_COLORS = ['#334d6e', '#53643a', '#62436d', '#6b4b3b', '#315f63', '#4b527a', '#684759', '#486046'] as const;
export interface InitialsAvatarAppearance {
  readonly personalized: boolean;
  readonly initials: string;
  readonly background: string | null;
  readonly foreground: string | null;
}
const neutralAvatar: InitialsAvatarAppearance = { personalized: false, initials: '', background: null, foreground: null };
const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });
const first = (word: string) => graphemes.segment(word)[Symbol.iterator]().next().value?.segment ?? '';

/** Public ID chooses the color; only the public nickname contributes visible letters. */
export function initialsAvatar(identity: string | null | undefined, nickname: string | null | undefined, neutral = false): InitialsAvatarAppearance {
  if (neutral || typeof identity !== 'string' || !identity.trim() || typeof nickname !== 'string') return neutralAvatar;
  const words = nickname.slice(0, 256).normalize('NFC').match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu);
  if (!words?.length) return neutralAvatar;
  const letters = (first(words[0]) + (words.length > 1 ? first(words[words.length - 1]) : '')).toUpperCase();
  const initials = [...graphemes.segment(letters)].slice(0, 2).map(part => part.segment).join('');
  let hash = 2166136261;
  for (const character of identity.trim().slice(0, 128)) hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619) >>> 0;
  return { personalized: true, initials, background: INITIALS_AVATAR_COLORS[hash % INITIALS_AVATAR_COLORS.length], foreground: '#ffffff' };
}
