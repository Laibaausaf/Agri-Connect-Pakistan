'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { makeI18n, type Lang } from '@/lib/i18n';

const LanguageContext = createContext<Lang>('en');

/** Gives client components the language the server rendered with. */
export function LanguageProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LanguageContext.Provider value={lang}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const lang = useContext(LanguageContext);
  return useMemo(() => makeI18n(lang), [lang]);
}
