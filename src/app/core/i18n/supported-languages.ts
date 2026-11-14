import localeEnGb from '@angular/common/locales/en-GB';
import localeEnUs from '@angular/common/locales/en';
import localeHr from '@angular/common/locales/hr';
import localeDe from '@angular/common/locales/de';
import localeEs from '@angular/common/locales/es';
import localeFr from '@angular/common/locales/fr';
import localePt from '@angular/common/locales/pt';
import localeRu from '@angular/common/locales/ru';
import localeJa from '@angular/common/locales/ja';
import localeSr from '@angular/common/locales/sr-Latn';
import localeBs from '@angular/common/locales/bs';
import localeSl from '@angular/common/locales/sl';
import localePl from '@angular/common/locales/pl';
import localeSk from '@angular/common/locales/sk';
import localeIt from '@angular/common/locales/it';
import localeCs from '@angular/common/locales/cs';
import localeHu from '@angular/common/locales/hu';
import en from '../../../assets/i18n/en.json';
import hr from '../../../assets/i18n/hr.json';
import de from '../../../assets/i18n/de.json';
import es from '../../../assets/i18n/es.json';
import fr from '../../../assets/i18n/fr.json';
import pt from '../../../assets/i18n/pt-BR.json';
import ru from '../../../assets/i18n/ru.json';
import ja from '../../../assets/i18n/ja.json';

import sr from '../../../assets/i18n/sr-Latn.json';
import bs from '../../../assets/i18n/bs.json';
import sl from '../../../assets/i18n/sl.json';
import pl from '../../../assets/i18n/pl.json';
import sk from '../../../assets/i18n/sk.json';
import it from '../../../assets/i18n/it.json';
import cs from '../../../assets/i18n/cs.json';
import hu from '../../../assets/i18n/hu.json';

// New feature modules fall back to English until reviewed translations exist.
// Merge leaf-by-leaf so an older partial module cannot expose raw message keys.
function withFantasyFallback<T extends object>(messages:T) {
  const merge = (fallback: Record<string, any>, translated: Record<string, any>): Record<string, any> =>
    Object.fromEntries(Object.entries({...fallback,...translated}).map(([key,value]) => [key,
      value && typeof value === 'object' && !Array.isArray(value)
        ? merge(fallback[key] ?? {}, translated[key] ?? {}) : value]));
  return merge(en,messages);
}

/**
 * Single registry for the picker, persistence, dictionaries and regional formats.
 * Regional variants may share one dictionary; do not add language branches to templates.
 * Date controls share the registry's field order for display, parsing and partial entry.
 * Flags are visual cues only; native language names identify the languages.
 */
export const SUPPORTED_LANGUAGES = [
  {
    code: 'en', locale: 'en-GB', nativeName: 'English (UK)', shortName: 'EN', flagIso2: 'gb',
    direction: 'ltr', dateSeparator: '/', dateSuffix: '', datePlaceholder: 'DD/MM/YYYY',
    dateFields: ['day', 'month', 'year'], datePattern: 'dd/MM/yyyy', decimalSeparator: '.', messages: en, angularLocale: localeEnGb
  },
  {
    code: 'en-US', locale: 'en-US', nativeName: 'English (US)', shortName: 'EN', flagIso2: 'us',
    direction: 'ltr', dateSeparator: '/', dateSuffix: '', datePlaceholder: 'MM/DD/YYYY',
    dateFields: ['month', 'day', 'year'], datePattern: 'MM/dd/yyyy', decimalSeparator: '.', messages: en, angularLocale: localeEnUs
  },
  {
    code: 'hr', locale: 'hr-HR', nativeName: 'Hrvatski', shortName: 'HR', flagIso2: 'hr',
    direction: 'ltr', dateSeparator: '.', dateSuffix: '.', datePlaceholder: 'DD.MM.YYYY',
    dateFields: ['day', 'month', 'year'], datePattern: 'dd.MM.yyyy.', decimalSeparator: ',', messages: hr, angularLocale: localeHr
  },
  {
    code: 'de', locale: 'de-DE', nativeName: 'Deutsch', shortName: 'DE', flagIso2: 'de',
    direction: 'ltr', dateSeparator: '.', dateSuffix: '', datePlaceholder: 'DD.MM.YYYY',
    dateFields: ['day', 'month', 'year'], datePattern: 'dd.MM.yyyy', decimalSeparator: ',', messages: withFantasyFallback(de), angularLocale: localeDe
  },
  {
    code: 'es', locale: 'es-ES', nativeName: 'Español', shortName: 'ES', flagIso2: 'es',
    direction: 'ltr', dateSeparator: '/', dateSuffix: '', datePlaceholder: 'DD/MM/YYYY',
    dateFields: ['day', 'month', 'year'], datePattern: 'dd/MM/yyyy', decimalSeparator: ',', messages: withFantasyFallback(es), angularLocale: localeEs
  },
  {
    code: 'fr', locale: 'fr-FR', nativeName: 'Français', shortName: 'FR', flagIso2: 'fr',
    direction: 'ltr', dateSeparator: '/', dateSuffix: '', datePlaceholder: 'DD/MM/YYYY',
    dateFields: ['day', 'month', 'year'], datePattern: 'dd/MM/yyyy', decimalSeparator: ',', messages: withFantasyFallback(fr), angularLocale: localeFr
  },
  {
    code: 'pt-BR', locale: 'pt-BR', nativeName: 'Português (Brasil)', shortName: 'PT', flagIso2: 'br',
    direction: 'ltr', dateSeparator: '/', dateSuffix: '', datePlaceholder: 'DD/MM/YYYY',
    dateFields: ['day', 'month', 'year'], datePattern: 'dd/MM/yyyy', decimalSeparator: ',', messages: withFantasyFallback(pt), angularLocale: localePt
  },
  {
    code: 'ru', locale: 'ru-RU', nativeName: 'Русский', shortName: 'RU', flagIso2: 'ru',
    direction: 'ltr', dateSeparator: '.', dateSuffix: '', datePlaceholder: 'DD.MM.YYYY',
    dateFields: ['day', 'month', 'year'], datePattern: 'dd.MM.yyyy', decimalSeparator: ',', messages: withFantasyFallback(ru), angularLocale: localeRu
  },
  {
    code: 'ja', locale: 'ja-JP', nativeName: '日本語', shortName: 'JA', flagIso2: 'jp',
    direction: 'ltr', dateSeparator: '/', dateSuffix: '', datePlaceholder: 'YYYY/MM/DD',
    dateFields: ['year', 'month', 'day'], datePattern: 'yyyy/MM/dd', decimalSeparator: '.', messages: withFantasyFallback(ja), angularLocale: localeJa
  },
  {
    code: 'sr-Latn', locale: 'sr-Latn-RS', nativeName: 'Srpski (latinica)', shortName: 'SR', flagIso2: 'rs',
    direction: 'ltr', dateSeparator: '.', dateSuffix: '.', datePlaceholder: 'DD.MM.YYYY',
    dateFields: ['day', 'month', 'year'], datePattern: 'dd.MM.yyyy.', decimalSeparator: ',', messages: withFantasyFallback(sr), angularLocale: localeSr
  },
  {
    code: 'bs', locale: 'bs-BA', nativeName: 'Bosanski', shortName: 'BS', flagIso2: 'ba',
    // Some Chromium ICU builds resolve bs-BA but return English numeric symbols.
    // Croatian has the same decimal/grouping and USD placement; language/plurals stay Bosnian.
    numberLocaleFallback: 'hr-HR',
    direction: 'ltr', dateSeparator: '.', dateSuffix: '.', datePlaceholder: 'DD.MM.YYYY',
    dateFields: ['day', 'month', 'year'], datePattern: 'dd.MM.yyyy.', decimalSeparator: ',', messages: withFantasyFallback(bs), angularLocale: localeBs
  },
  {
    code: 'sl', locale: 'sl-SI', nativeName: 'Slovenščina', shortName: 'SL', flagIso2: 'si',
    direction: 'ltr', dateSeparator: '.', dateSuffix: '', datePlaceholder: 'DD.MM.YYYY',
    dateFields: ['day', 'month', 'year'], datePattern: 'dd.MM.yyyy', decimalSeparator: ',', messages: withFantasyFallback(sl), angularLocale: localeSl
  },
  {
    code: 'pl', locale: 'pl-PL', nativeName: 'Polski', shortName: 'PL', flagIso2: 'pl',
    direction: 'ltr', dateSeparator: '.', dateSuffix: '', datePlaceholder: 'DD.MM.YYYY',
    dateFields: ['day', 'month', 'year'], datePattern: 'dd.MM.yyyy', decimalSeparator: ',', messages: withFantasyFallback(pl), angularLocale: localePl
  },
  {
    code: 'sk', locale: 'sk-SK', nativeName: 'Slovenčina', shortName: 'SK', flagIso2: 'sk',
    direction: 'ltr', dateSeparator: '.', dateSuffix: '', datePlaceholder: 'DD.MM.YYYY',
    dateFields: ['day', 'month', 'year'], datePattern: 'dd.MM.yyyy', decimalSeparator: ',', messages: withFantasyFallback(sk), angularLocale: localeSk
  },
  {
    code: 'it', locale: 'it-IT', nativeName: 'Italiano', shortName: 'IT', flagIso2: 'it',
    direction: 'ltr', dateSeparator: '/', dateSuffix: '', datePlaceholder: 'DD/MM/YYYY',
    dateFields: ['day', 'month', 'year'], datePattern: 'dd/MM/yyyy', decimalSeparator: ',', messages: withFantasyFallback(it), angularLocale: localeIt
  },
  {
    code: 'cs', locale: 'cs-CZ', nativeName: 'Čeština', shortName: 'CS', flagIso2: 'cz',
    direction: 'ltr', dateSeparator: '.', dateSuffix: '', datePlaceholder: 'DD.MM.YYYY',
    dateFields: ['day', 'month', 'year'], datePattern: 'dd.MM.yyyy', decimalSeparator: ',', messages: withFantasyFallback(cs), angularLocale: localeCs
  },
  {
    code: 'hu', locale: 'hu-HU', nativeName: 'Magyar', shortName: 'HU', flagIso2: 'hu',
    direction: 'ltr', dateSeparator: '.', dateSuffix: '.', datePlaceholder: 'YYYY.MM.DD',
    dateFields: ['year', 'month', 'day'], datePattern: 'yyyy.MM.dd.', decimalSeparator: ',', messages: withFantasyFallback(hu), angularLocale: localeHu
  }
] as const;

export type UiLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];
export type UiLocale = typeof SUPPORTED_LANGUAGES[number]['locale'];
export const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES[0];

export function isSupportedLanguage(value: unknown): value is UiLanguage {
  return SUPPORTED_LANGUAGES.some(language => language.code === value);
}
export function languageSettings(code: UiLanguage) {
  return SUPPORTED_LANGUAGES.find(language => language.code === code) ?? DEFAULT_LANGUAGE;
}
export function localeSettings(locale: UiLocale) {
  return SUPPORTED_LANGUAGES.find(language => language.locale === locale) ?? DEFAULT_LANGUAGE;
}

