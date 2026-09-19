import { en } from './dictionaries/en';
import { fa } from './dictionaries/fa';

export type Locale = 'fa' | 'en';
export type TranslationKey = keyof typeof en;

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, fa };

export function getDirection(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'fa' ? 'rtl' : 'ltr';
}

export function createTranslator(locale: Locale) {
  return (key: TranslationKey): string => dictionaries[locale][key] ?? en[key];
}

export { en, fa };
