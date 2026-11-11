export interface IndexMatchCountFields {
  totalMatches?: number | null;
  finishedMatches?: number | null;
  numberOfMatches?: number | null;
}

/** Total match count, with compatibility for index archives created before totalMatches existed. */
export function totalMatchesOrLegacy(value: IndexMatchCountFields | null | undefined): number | null {
  return value?.totalMatches ?? value?.numberOfMatches ?? null;
}

