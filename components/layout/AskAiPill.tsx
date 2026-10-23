'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/components/i18n/LanguageProvider';
import Icon from '@/components/ui/Icon';

/**
 * "Ask AgriConnect" pill above the phone bottom bar on farmer and trader
 * screens. It only opens the assistant; the microphone is there.
 */
export default function AskAiPill() {
  const pathname = usePathname() ?? '';
  const { t } = useI18n();
  if (pathname.startsWith('/ai-assistant')) return null;

  return (
    <Link
      href="/ai-assistant"
      aria-label={t('askAi.aria')}
      className="ac-press fixed bottom-[calc(96px+env(safe-area-inset-bottom))] end-4 z-30 inline-flex h-16 items-center gap-3 rounded-full bg-[linear-gradient(135deg,#0F3D2E_0%,#17603C_70%,#23804A_100%)] pe-5 ps-2 text-white shadow-[0_14px_30px_-10px_rgba(15,61,46,.65),inset_0_0_0_1px_rgba(255,255,255,.08)] lg:hidden"
    >
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold text-ongold">
        <Icon name="mic" size={24} stroke={2.3} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="whitespace-nowrap text-[15px] font-extrabold leading-tight">{t('askAi.title')}</span>
        <span className="whitespace-nowrap text-[12.5px] font-semibold leading-tight text-[#D6E6D9]">{t('askAi.sub')}</span>
      </span>
    </Link>
  );
}
