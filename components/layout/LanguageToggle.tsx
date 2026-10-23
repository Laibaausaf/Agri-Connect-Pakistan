'use client';

import { useRouter } from 'next/navigation';
import { LANG_COOKIE, type Lang } from '@/lib/i18n';
import { useI18n } from '@/components/i18n/LanguageProvider';

/**
 * English | اردو switch. The choice is kept in a cookie for a year, so it
 * survives page changes and later visits; the page then re-renders on the
 * server in the new language.
 */
export default function LanguageToggle({ tone = 'brand', compact = false }: { tone?: 'brand' | 'paper'; compact?: boolean }) {
  const router = useRouter();
  const { lang, t } = useI18n();

  function choose(next: Lang) {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  const option = (value: Lang, label: string) => (
    <button
      type="button"
      onClick={() => choose(value)}
      aria-pressed={lang === value}
      lang={value}
      className={`rounded-[9px] px-2.5 transition-colors ${compact ? 'h-[38px] min-w-11' : 'h-10 px-3.5'} ${
        value === 'ur' ? 'font-[family-name:var(--font-naskh)] text-[15px] font-bold' : 'font-[family-name:var(--font-jakarta)] text-[13px] font-extrabold'
      } ${
        lang === value
          ? 'bg-gold text-ongold'
          : tone === 'brand'
            ? 'text-white hover:bg-white/10'
            : 'text-ink hover:bg-line'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label={t('header.languageLabel')}
      className={`inline-flex shrink-0 items-center rounded-xl p-[3px] ${compact ? 'h-11' : 'h-12 p-1'} ${
        tone === 'brand' ? 'bg-black/[.18]' : 'bg-sage'
      }`}
    >
      {option('en', compact ? t('header.switchToEnglishShort') : t('header.switchToEnglish'))}
      {option('ur', t('header.switchToUrdu'))}
    </div>
  );
}
