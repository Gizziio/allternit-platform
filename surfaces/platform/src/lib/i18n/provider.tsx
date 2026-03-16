/**
 * Internationalization (i18n) Provider and Hook
 *
 * React context provider and hook for using translations throughout the application.
 *
 * @module i18n/provider
 * @version 1.0.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { LanguageCode, I18nContextType, Translations, TranslationKey } from './types';

// Import English translations (default)
import enTranslations from './locales/en.json';

// Placeholder for additional languages (to be added as needed)
// import esTranslations from './locales/es.json';
// import frTranslations from './locales/fr.json';

/**
 * Available translations by language code
 */
const TRANSLATIONS: Record<LanguageCode, Translations> = {
  en: enTranslations as Translations,
  es: enTranslations as Translations, // Fallback to English
  fr: enTranslations as Translations, // Fallback to English
  de: enTranslations as Translations, // Fallback to English
  ja: enTranslations as Translations, // Fallback to English
  zh: enTranslations as Translations, // Fallback to English
  pt: enTranslations as Translations, // Fallback to English
  ko: enTranslations as Translations, // Fallback to English
};

/**
 * Default language
 */
const DEFAULT_LANGUAGE: LanguageCode = 'en';

/**
 * Storage key for language preference
 */
const LANGUAGE_STORAGE_KEY = 'a2r_i18n_language';

/**
 * Create the i18n context
 */
const I18nContext = createContext<I18nContextType | undefined>(undefined);

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Interpolate parameters into translation string
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * i18n Provider Props
 */
interface I18nProviderProps {
  children: ReactNode;
  defaultLanguage?: LanguageCode;
  storageKey?: string;
}

/**
 * i18n Provider Component
 *
 * Provides internationalization context to all child components.
 *
 * Features:
 * - Language persistence in localStorage
 * - System language detection
 * - Translation interpolation with parameters
 * - Loading state management
 * - Error handling for missing translations
 *
 * @example
 * ```tsx
 * <I18nProvider>
 *   <App />
 * </I18nProvider>
 * ```
 */
export function I18nProvider({
  children,
  defaultLanguage = DEFAULT_LANGUAGE,
  storageKey = LANGUAGE_STORAGE_KEY,
}: I18nProviderProps) {
  const [language, setLanguageState] = useState<LanguageCode>(defaultLanguage);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Initialize language from storage or system preference
   */
  useEffect(() => {
    try {
      // Try to load from localStorage
      const stored = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;

      if (stored && stored in TRANSLATIONS) {
        setLanguageState(stored as LanguageCode);
      } else {
        // Try to detect system language
        if (typeof navigator !== 'undefined') {
          const systemLang = navigator.language.split('-')[0] as LanguageCode;
          if (systemLang in TRANSLATIONS) {
            setLanguageState(systemLang);
          }
        }
      }
    } catch (err) {
      console.error('[i18n] Error loading language preference:', err);
      setError(err instanceof Error ? err : new Error('Failed to load language preference'));
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [storageKey]);

  /**
   * Set language and persist to storage
   */
  const setLanguage = useCallback((newLang: LanguageCode) => {
    if (!(newLang in TRANSLATIONS)) {
      console.warn(`[i18n] Language "${newLang}" not available, falling back to "${DEFAULT_LANGUAGE}"`);
      newLang = DEFAULT_LANGUAGE;
    }

    setLanguageState(newLang);

    // Persist to localStorage
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, newLang);
      }
    } catch (err) {
      console.error('[i18n] Error saving language preference:', err);
    }
  }, [storageKey]);

  /**
   * Translate function with parameter interpolation
   */
  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    const translations = TRANSLATIONS[language];
    const value = getNestedValue(translations as unknown as Record<string, unknown>, key);

    if (value === undefined) {
      // Fallback to English
      const fallbackValue = getNestedValue(TRANSLATIONS.en as unknown as Record<string, unknown>, key);

      if (fallbackValue !== undefined) {
        return interpolate(fallbackValue, params);
      }

      // If still not found, return the key itself (useful for debugging)
      console.warn(`[i18n] Missing translation for key: "${key}" in language: "${language}"`);
      return key;
    }

    return interpolate(value, params);
  }, [language]);

  const contextValue: I18nContextType = {
    language,
    setLanguage,
    t,
    ready,
    loading,
    error,
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * useTranslation Hook
 *
 * Access i18n context in components.
 *
 * @returns i18n context with language, translation function, and state
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { t, language, setLanguage } = useTranslation();
 *
 *   return (
 *     <div>
 *       <h1>{t('steps.identity.title')}</h1>
 *       <button onClick={() => setLanguage('es')}>Switch to Spanish</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTranslation(): I18nContextType {
  const context = useContext(I18nContext);

  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }

  return context;
}

/**
 * Get available languages
 */
export function getAvailableLanguages(): LanguageCode[] {
  return Object.keys(TRANSLATIONS) as LanguageCode[];
}

/**
 * Check if a language is available
 */
export function isLanguageAvailable(code: string): code is LanguageCode {
  return code in TRANSLATIONS;
}

/**
 * Get language info for display
 */
export function getLanguageInfo(code: LanguageCode): { name: string; nativeName: string; flag: string } {
  const info: Record<LanguageCode, { name: string; nativeName: string; flag: string }> = {
    en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
    es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
    pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
    ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  };

  return info[code] || info.en;
}
