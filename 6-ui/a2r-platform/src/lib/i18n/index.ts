/**
 * Internationalization (i18n) Module
 *
 * Central export for all i18n functionality.
 *
 * @module i18n
 * @version 1.0.0
 */

export { I18nProvider, useTranslation, getAvailableLanguages, isLanguageAvailable, getLanguageInfo } from './provider';
export type {
  LanguageCode,
  LanguageInfo,
  TranslationResource,
  Translations,
  I18nContextType,
  TranslationKey,
} from './types';
