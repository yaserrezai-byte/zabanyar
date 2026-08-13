// ============================================================
// زبان‌یار | Language registry
//
// Single source of truth for every language the platform teaches.
// Adding a third language should mean adding one entry here plus a
// content bank — never touching page components.
// ============================================================

export type LearningLanguage = 'en' | 'es';

export const LEARNING_LANGUAGES: LearningLanguage[] = ['en', 'es'];

export interface LanguageConfig {
  code: LearningLanguage;
  /** Persian name, used in all UI copy. */
  nameFa: string;
  /** Endonym — how the language calls itself. */
  nameNative: string;
  flag: string;
  /** BCP-47 tag for speech synthesis and recognition. */
  speechLang: string;
  /**
   * Accent note shown to the learner, so they know which variety
   * the app teaches and why.
   */
  accentFa: string;
  /** Direction of the target language itself (both LTR for now). */
  dir: 'ltr' | 'rtl';
  /** Brand accent for this track, used sparingly to aid orientation. */
  color: string;
  /** One-line pitch on the language picker. */
  taglineFa: string;
  /** Column suffix used by legacy fields (example_en etc.). */
  legacySuffix: string;
}

export const LANGUAGES: Record<LearningLanguage, LanguageConfig> = {
  en: {
    code: 'en',
    nameFa: 'انگلیسی',
    nameNative: 'English',
    flag: '🇬🇧',
    speechLang: 'en-US',
    accentFa: 'لهجه آمریکایی',
    dir: 'ltr',
    color: 'var(--color-primary-600)',
    taglineFa: 'زبان بین‌المللی کار، تحصیل و اینترنت',
    legacySuffix: 'en',
  },
  es: {
    code: 'es',
    nameFa: 'اسپانیایی',
    nameNative: 'Español',
    flag: '🇪🇸',
    // Castilian Spanish — the variety taught in Iranian institutes and
    // the one Spanish media/literature most commonly uses.
    speechLang: 'es-ES',
    accentFa: 'لهجه اسپانیای اروپا (کاستیلی)',
    dir: 'ltr',
    color: 'var(--color-accent-700)',
    taglineFa: 'زبان دوم پرگویشور جهان، در ۲۰ کشور',
    legacySuffix: 'es',
  },
};

export const DEFAULT_LANGUAGE: LearningLanguage = 'en';

/** Narrow an untrusted value to a supported language code. */
export function toLanguage(value: unknown): LearningLanguage {
  return value === 'es' || value === 'en' ? value : DEFAULT_LANGUAGE;
}

export function isLanguage(value: unknown): value is LearningLanguage {
  return value === 'en' || value === 'es';
}

/** Persian name, safe for any input. */
export function languageNameFa(value: unknown): string {
  return LANGUAGES[toLanguage(value)].nameFa;
}

export function languageConfig(value: unknown): LanguageConfig {
  return LANGUAGES[toLanguage(value)];
}

/**
 * Cookie that remembers the active language between requests so a
 * server component can render the right track before hitting the DB.
 */
export const LANGUAGE_COOKIE = 'zy_lang';
