export interface NnFeatureHelpEntry {
  title?: string;
  shortDescription: string;
  technicalNote?: string;
}

import en from '../../../assets/i18n/en.json';

type FeatureCopy = { label: string; shortDescription?: string; technicalNote?: string };

/**
 * English fallback and availability registry derived from the canonical translation catalog.
 * Display consumers resolve the active language; feature names remain stable model identifiers.
 * Do not fabricate help for features whose semantics have not been documented.
 */
export const NN_FEATURE_HELP: Readonly<Record<string, NnFeatureHelpEntry>> = Object.freeze(
  Object.fromEntries(Object.entries(en.nn.features as Record<string, FeatureCopy>)
    .flatMap(([name, entry]) => entry.shortDescription
      ? [[name, { shortDescription: entry.shortDescription, technicalNote: entry.technicalNote }]]
      : []))
);
