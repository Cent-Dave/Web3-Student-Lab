'use client';

import React from 'react';
import { useI18n, type Locale } from '@/i18n';

const locales: Array<{ id: Locale; labelKey: string }> = [
  { id: 'en', labelKey: 'language.english' },
  { id: 'es', labelKey: 'language.spanish' },
  { id: 'zh', labelKey: 'language.chinese' },
];

export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="relative inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors cursor-pointer group">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-current transition-colors"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="appearance-none bg-transparent text-xs font-bold tracking-widest text-current uppercase outline-none cursor-pointer pr-4"
        aria-label="Language selector"
      >
        {locales.map((item) => (
          <option key={item.id} value={item.id} className="bg-zinc-900 text-white font-sans">
            {t(item.labelKey)}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2 text-gray-400">
        <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
      </div>
    </div>
  );
}
