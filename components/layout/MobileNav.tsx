'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { MORE_TAB, ROLE_MOBILE_NAV, ROLE_NAV, ROLE_PRIMARY_ACTION, type NavBadges } from '@/lib/navigation';
import { useI18n } from '@/components/i18n/LanguageProvider';
import Icon from '@/components/ui/Icon';
import { NavBadge, isActivePath } from './Sidebar';

type MobileNavProps = {
  role: UserRole;
  badges: NavBadges;
};

/** Five-tab bottom bar on phones; "More" opens every other page of the role. */
export default function MobileNav({ role, badges }: MobileNavProps) {
  const pathname = usePathname() ?? '';
  const { t, nav, navSection } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = ROLE_MOBILE_NAV[role] ?? [];
  const tabHrefs = items.map((item) => item.href).filter((href) => href !== MORE_TAB);
  const onTab = tabHrefs.some((href) => isActivePath(pathname, href));
  const primaryAction = ROLE_PRIMARY_ACTION[role];

  // Close the sheet after navigating.
  useEffect(() => setMoreOpen(false), [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMoreOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t('header.close')}
            onClick={() => setMoreOpen(false)}
            className="ac-fade absolute inset-0 h-full w-full cursor-default bg-[#0B1A14]/45"
          />
          <div
            role="dialog"
            aria-label={t('more.aria')}
            className="ac-sheet absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-[26px] bg-sf px-4 pb-28 pt-3 text-ink shadow-card"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display h-section font-semibold">{t('more.title')}</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label={t('header.close')}
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-sage"
              >
                <Icon name="x" size={20} />
              </button>
            </div>
            {primaryAction && (
              <Link href={primaryAction.href} className="btn btn-gold-outline mb-4 w-full">
                <Icon name="pluscircle" size={20} />
                {nav(primaryAction.label, role)}
              </Link>
            )}
            {(ROLE_NAV[role] ?? []).map((section) => (
              <div key={section.title} className="mb-4">
                <div className="px-1 pb-1.5 text-xs font-bold uppercase tracking-[.08em] text-muted">{navSection(section.title)}</div>
                <div className="overflow-hidden rounded-2xl border border-line">
                  {section.items.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-h-14 items-center gap-3 border-b border-line px-3 last:border-b-0 ${
                          active ? 'bg-sage font-extrabold' : 'font-semibold'
                        }`}
                      >
                        <span
                          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
                            active ? 'bg-gold text-ongold' : 'bg-sage text-forest'
                          }`}
                        >
                          <Icon name={item.icon} size={20} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[15px]">{nav(item.label, role)}</span>
                        <NavBadge item={item} badges={badges} />
                        <Icon name="chevronright" size={18} className="text-muted" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="flex items-start gap-2 px-1 text-[13px] text-muted">
              <Icon name="shield" size={16} className="mt-0.5" />
              <span>
                {t('header.raast')} · {t('header.bannerShort')}
              </span>
            </p>
          </div>
        </div>
      )}

      <nav
        aria-label={t('sidebar.menuLabel')}
        className="pb-safe fixed inset-x-0 bottom-0 z-40 grid gap-0.5 border-t border-line bg-sf px-2 pt-2 shadow-[0_-8px_24px_-16px_rgba(15,61,46,.35)] lg:hidden"
        style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const isMore = item.href === MORE_TAB;
          const active = isMore ? moreOpen || !onTab : !moreOpen && isActivePath(pathname, item.href);
          const count = item.badge ? badges[item.badge] ?? 0 : 0;
          const content = (
            <>
              <span
                className={`inline-flex h-8 w-[52px] items-center justify-center rounded-full ${
                  active ? 'bg-gold text-ongold' : 'text-muted'
                }`}
              >
                <Icon name={item.icon} size={22} stroke={active ? 2.3 : 2} />
              </span>
              <span className={`max-w-full truncate text-[12.5px] leading-tight ${active ? 'font-extrabold text-ink' : 'font-semibold text-muted'}`}>
                {nav(item.label, role)}
              </span>
              {count > 0 && item.badgeStyle === 'live' && (
                <span className="ac-pulse absolute end-[22%] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-sf bg-gold" aria-hidden="true" />
              )}
              {count > 0 && item.badgeStyle !== 'live' && (
                <span className="tabular absolute end-[14%] top-0.5 h-5 min-w-5 rounded-[10px] border-2 border-sf bg-err-fg px-1 text-center text-[11px] font-extrabold leading-4 text-white dark:text-[#2A0B07]">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </>
          );
          const className = 'ac-press relative flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl';
          return isMore ? (
            <button
              key={item.href}
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              className={className}
            >
              {content}
            </button>
          ) : (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={className}>
              {content}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
