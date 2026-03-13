'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Languages } from 'lucide-react';
import { useT, LOCALE_NAMES, LOCALE_FLAGS, type Locale } from '../../lib/i18n';

interface LanguageSelectorProps {
  className?: string;
  compact?: boolean;
}

export function LanguageSelector({ className = '', compact = false }: LanguageSelectorProps) {
  const { locale, setLocale } = useT();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [openDirection, setOpenDirection] = useState<'down' | 'up'>('down');

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Determine if dropdown should open up or down based on available space
  const handleToggle = () => {
    if (!isOpen && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const dropdownHeight = 160; // approximate height of 3 items
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenDirection(spaceBelow < dropdownHeight && spaceAbove > dropdownHeight ? 'up' : 'down');
    }
    setIsOpen(!isOpen);
  };

  const locales: Locale[] = ['it', 'en', 'es'];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={handleToggle}
        className={`flex items-center gap-1.5 rounded-xl transition-all duration-200 ${
          compact
            ? 'p-2 hover:bg-white/10'
            : 'px-3 py-2 bg-slate-800/60 hover:bg-slate-700/60 border border-white/10'
        }`}
        title={LOCALE_NAMES[locale]}
      >
        <Languages className="w-4 h-4 text-slate-400" />
        {!compact && (
          <>
            <span className="text-sm text-slate-300">{LOCALE_FLAGS[locale]}</span>
            <span className="text-xs text-slate-400 hidden sm:inline">{locale.toUpperCase()}</span>
          </>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            openDirection === 'up'
              ? 'bottom-full mb-2'
              : 'top-full mt-2'
          } right-0 min-w-[160px] bg-[#0c1222] border border-white/10 rounded-xl shadow-xl z-50 py-1 backdrop-blur-xl overflow-hidden`}
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => {
                setLocale(loc);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors ${
                locale === loc
                  ? 'bg-primary-500/10 text-primary-400'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <span className="text-lg">{LOCALE_FLAGS[loc]}</span>
              <span className="text-sm font-medium">{LOCALE_NAMES[loc]}</span>
              {locale === loc && (
                <span className="ml-auto text-primary-400 text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
