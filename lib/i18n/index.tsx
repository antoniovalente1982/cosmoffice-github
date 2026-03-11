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

/**
 * Detect the best locale from browser settings.
 * Italian browser → IT, Spanish browser → ES, everything else → EN (English).
 */
function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const langs = navigator.languages || [navigator.language];
  for (const lang of langs) {
    const code = lang.split('-')[0].toLowerCase();
    if (code === 'it') return 'it';
    if (code === 'es') return 'es';
  }
  return 'en';
}

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  /** Call after login to sync the locale from the user's DB profile */
  syncFromProfile: () => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'it',
  setLocale: () => {},
  t: (key) => key,
  syncFromProfile: async () => {},
});

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

  /**
   * Save locale to DB (profiles.language).
   * Called automatically when an authenticated user changes language.
   */
  const saveLocaleToProfile = useCallback(async (newLocale: Locale) => {
    try {
      // Dynamic import to avoid SSR issues and circular deps
      const { createClient } = await import('../../utils/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ language: newLocale })
          .eq('id', user.id);
      }
    } catch {
      // Silently fail — not critical for UX
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLocale);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
    }
    // Also persist to DB for authenticated users (fire-and-forget)
    saveLocaleToProfile(newLocale);
  }, [saveLocaleToProfile]);

  /**
   * Sync locale from the user's DB profile.
   * Should be called once after authentication is confirmed.
   */
  const syncFromProfile = useCallback(async () => {
    try {
      const { createClient } = await import('../../utils/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', user.id)
        .single();

      if (profile?.language && dictionaries[profile.language as Locale]) {
        const dbLocale = profile.language as Locale;
        setLocaleState(dbLocale);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, dbLocale);
        }
        if (typeof document !== 'undefined') {
          document.documentElement.lang = dbLocale;
        }
      }
    } catch {
      // Silently fail
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

  const value = useMemo(() => ({ locale, setLocale, t, syncFromProfile }), [locale, setLocale, t, syncFromProfile]);

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
