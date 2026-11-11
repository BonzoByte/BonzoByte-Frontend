/** Stable database IDs first; legacy archives may only contain the canonical name. */
export function playsTranslationKey(id?: number | null, name?: string | null): string {
  if (id === 1) return 'plays.right';
  if (id === 2) return 'plays.left';
  if (id != null) return 'plays.unknown';
  switch (name?.trim().toLowerCase()) {
    case 'right': return 'plays.right';
    case 'left': return 'plays.left';
    default: return 'plays.unknown';
  }
}
