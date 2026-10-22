'use client';

import { useRouter } from 'next/navigation';
import { Languages } from 'lucide-react';
import { LANG_COOKIE, type Lang } from '@/lib/i18n';
import { useI18n } from '@/components/i18n/LanguageProvider';

/**
 * English | اردو switch. The choice is kept in a cookie for a year, so it
 * survives page changes and later visits; the page then re-renders on the
 * server in the new language.
 */
export default function LanguageToggle() {
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
      className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
        lang === value ? 'bg-agri-900 text-white' : 'bg-white text-[#636E72] hover:bg-[#F8F9F5]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label={t('header.languageLabel')}
      className="flex items-center rounded-lg border border-[#E5E7EB] overflow-hidden"
    >
      <span className="px-1.5 text-[#636E72]" aria-hidden="true">
        <Languages className="w-3.5 h-3.5" />
      </span>
      {option('en', t('header.switchToEnglish'))}
      {option('ur', t('header.switchToUrdu'))}
    </div>
  );
}
