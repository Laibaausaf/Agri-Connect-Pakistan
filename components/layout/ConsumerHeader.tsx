'use client';

import Link from 'next/link';
import { logout } from '@/lib/actions/auth';
import { useI18n } from '@/components/i18n/LanguageProvider';
import LanguageToggle from '@/components/layout/LanguageToggle';
import ThemeToggle from '@/components/layout/ThemeToggle';
import Icon from '@/components/ui/Icon';
import BrandGlow from '@/components/ui/BrandGlow';

type ConsumerHeaderProps = {
  name: string;
  location: string;
};

export default function ConsumerHeader({ name, location }: ConsumerHeaderProps) {
  const { t } = useI18n();
  const logoutButton = (
    <form action={logout}>
      <button
        type="submit"
        title={t('header.logout')}
        className="ac-press inline-flex h-12 shrink-0 items-center gap-1.5 rounded-[14px] bg-white/[.12] px-3 text-sm font-bold text-white hover:bg-white/20"
      >
        <Icon name="logout" size={20} />
        <span className="hidden sm:inline">{t('header.logout')}</span>
      </button>
    </form>
  );

  return (
    <header className="sticky top-0 z-50 bg-brand text-white">
      <BrandGlow />
      <div className="relative mx-auto flex max-w-5xl flex-col gap-1.5 px-4 pb-3 pt-2.5 sm:flex-row sm:items-center sm:gap-3 sm:py-3">
        <div className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5">
          <Link href="/shop" className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold text-ongold">
              <Icon name="leaf" size={24} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="whitespace-nowrap text-[17px] font-extrabold leading-tight">{t('consumer.brand')}</span>
              <span className="truncate text-xs font-semibold text-[#D6E6D9]">{t('consumer.hi', { name: name.split(' ')[0] })}</span>
            </span>
          </Link>
          <span className="sm:hidden">{logoutButton}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-white/[.22] px-2.5 text-[13.5px] font-semibold sm:max-w-[280px]">
            <Icon name="pin" size={18} />
            <span className="truncate">{location}</span>
          </span>
          <LanguageToggle compact />
          <ThemeToggle compact />
          <span className="hidden sm:inline">{logoutButton}</span>
        </div>
      </div>
    </header>
  );
}
