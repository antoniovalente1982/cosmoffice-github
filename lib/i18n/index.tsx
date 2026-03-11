'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { it, type TranslationKey } from './it';
import { en } from './en';
import { es } from './es';

export type Locale = 'it' | 'en' | 'es';

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { it, en, es };

export const LOCALE_NAMES: Record<Locale, string> = {
  it: 'Italiano',
  en: 'English',
  es: 'Español',
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  it: '🇮🇹',
  en: '🇬🇧',
  es: '🇪🇸',
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'it',
  setLocale: () => {},
  t: (key) => key,
});

/**
 * Detect the best locale from browser settings.
 * Falls back to 'it' (Italian) as default.
 */
function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'it';
  const langs = navigator.languages || [navigator.language];
  for (const lang of langs) {
    const code = lang.split('-')[0].toLowerCase();
    if (code === 'en') return 'en';
    if (code === 'es') return 'es';
    if (code === 'it') return 'it';
  }
  return 'it';
}

const STORAGE_KEY = 'cosmoffice_locale';

export function LanguageProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    // Priority: prop > localStorage > browser detection
    if (initialLocale) return initialLocale;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && dictionaries[stored]) return stored;
    }
    return detectBrowserLocale();
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLocale);
    }
    // Update html lang attribute
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
    }
  }, []);

  // Sync html lang on mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const t = useCallback((key: TranslationKey, vars?: Record<string, string | number>): string => {
    let text = dictionaries[locale]?.[key] || dictionaries['it'][key] || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return text;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook to access i18n translation function and current locale.
 * Usage: const { t, locale, setLocale } = useT();
 *        <span>{t('auth.login')}</span>
 */
export function useT() {
  return useContext(LanguageContext);
}

// Re-export types for convenience
export type { TranslationKey };
