'use client';

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { THEME_COOKIE, type Theme } from '@/lib/theme';
import { useI18n } from '@/components/i18n/LanguageProvider';
import Icon from '@/components/ui/Icon';

const ThemeContext = createContext<Theme>('light');

/** Gives client components the theme the server rendered with. */
export function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/**
 * Light/Dark switch. The choice is kept in a cookie for a year and applied at
 * once by swapping the colour tokens on <html>; no page reload is needed.
 * The button names the theme it switches to.
 */
export default function ThemeToggle({ tone = 'brand', compact = false }: { tone?: 'brand' | 'paper'; compact?: boolean }) {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>(useContext(ThemeContext));
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  function toggle() {
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  }

  const toneClass =
    tone === 'brand'
      ? 'bg-white/[.12] text-white hover:bg-white/20'
      : 'bg-sage text-ink hover:bg-line';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t(next === 'dark' ? 'theme.toDarkAria' : 'theme.toLightAria')}
      className={`ac-press inline-flex shrink-0 items-center gap-1.5 rounded-xl font-bold ${
        compact ? 'h-11 px-3 text-[13.5px]' : 'h-12 px-3.5 text-sm'
      } ${toneClass}`}
    >
      <Icon name={next === 'dark' ? 'moon' : 'sun'} size={compact ? 18 : 19} />
      <span>{t(next === 'dark' ? 'theme.dark' : 'theme.light')}</span>
    </button>
  );
}
