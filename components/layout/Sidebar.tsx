'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { ROLE_NAV, ROLE_PRIMARY_ACTION, type NavBadges, type NavEntry } from '@/lib/navigation';
import { useI18n } from '@/components/i18n/LanguageProvider';
import Icon from '@/components/ui/Icon';
import { initialsOf } from '@/lib/initials';

type SidebarProps = {
  role: UserRole;
  badges: NavBadges;
  userName: string;
  userCity?: string | null;
  aiHint?: string;
};

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Count, "live" marker or nothing, from the role's nav badges. */
export function NavBadge({ item, badges, onDark = false }: { item: NavEntry; badges: NavBadges; onDark?: boolean }) {
  const { t } = useI18n();
  if (!item.badge) return null;
  const value = badges[item.badge] ?? 0;
  if (!value) return null;

  if (item.badgeStyle === 'live') {
    return (
      <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-xl bg-gold px-2.5 text-[11.5px] font-extrabold text-ongold">
        <span className="ac-pulse h-[7px] w-[7px] rounded-full bg-ongold" />
        {t('sidebar.live')}
      </span>
    );
  }
  return (
    <span
      className={`tabular h-6 min-w-6 shrink-0 rounded-xl px-[7px] text-center text-[12.5px] font-extrabold leading-6 ${
        onDark ? 'bg-[rgba(232,163,61,.22)] text-[#F6C871]' : 'bg-gold text-ongold'
      }`}
    >
      {value}
    </span>
  );
}

export default function Sidebar({ role, badges, userName, userCity, aiHint }: SidebarProps) {
  const pathname = usePathname() ?? '';
  const { t, nav, navSection, role: roleName } = useI18n();
  const sections = ROLE_NAV[role] ?? [];
  const primaryAction = ROLE_PRIMARY_ACTION[role];

  return (
    <aside className="hidden w-[272px] shrink-0 select-none flex-col gap-5 overflow-y-auto bg-side px-4 py-6 text-sidetext lg:flex">
      {primaryAction && (
        <Link
          href={primaryAction.href}
          className="ac-press flex h-14 items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-gold bg-[rgba(232,163,61,.12)] text-base font-extrabold text-[#F6C871] hover:bg-[rgba(232,163,61,.2)]"
        >
          <Icon name="pluscircle" size={22} stroke={2.4} />
          <span>{nav(primaryAction.label, role)}</span>
        </Link>
      )}

      <nav aria-label={t('sidebar.menuLabel')} className="flex flex-col gap-[18px]">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <span className="px-3 pb-1.5 text-xs font-bold uppercase tracking-[.08em] opacity-[.72]">
              {navSection(section.title)}
            </span>
            {section.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`ac-press flex min-h-12 items-center gap-3 rounded-[14px] px-3 text-[15px] ${
                    active ? 'bg-white/[.12] font-extrabold text-white' : 'font-semibold hover:bg-white/[.06]'
                  }`}
                >
                  <span
                    className={`inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] ${
                      active ? 'bg-gold text-ongold' : 'bg-white/[.06]'
                    }`}
                  >
                    <Icon name={item.icon} size={20} stroke={active ? 2.3 : 2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{nav(item.label, role)}</span>
                  <NavBadge item={item} badges={badges} onDark />
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <span className="flex-1" />

      {aiHint && (
        <Link
          href="/ai-assistant"
          className="ac-press flex flex-col gap-2.5 rounded-[18px] border border-white/10 bg-white/[.07] p-4 hover:bg-white/10"
        >
          <span className="flex items-center gap-2 text-[12.5px] font-extrabold tracking-[.04em] text-[#F6C871]">
            <Icon name="sparkles" size={18} />
            {t('sidebar.aiTitle')}
          </span>
          <span className="text-[14.5px] font-medium leading-relaxed">{aiHint}</span>
          <span className="inline-flex items-center gap-1.5 text-[13.5px] font-extrabold text-white">
            <Icon name="mic" size={18} />
            {t('sidebar.askByVoice')}
          </span>
        </Link>
      )}

      <div className="flex items-center gap-3 border-t border-white/10 px-1 pt-4">
        <span className="h-10 w-10 shrink-0 rounded-full bg-sage text-center text-sm font-extrabold leading-10 text-forest font-[family-name:var(--font-jakarta)]" dir="ltr">
          {initialsOf(userName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-white">{userName}</div>
          <div className="truncate text-[13px]">
            {roleName(role)}
            {userCity ? ` • ${userCity}` : ''}
          </div>
        </div>
      </div>
      <p className="px-1 text-xs leading-relaxed opacity-70">
        <span className="font-bold">{t('header.raast')}</span> · {t('header.bannerLong')}
      </p>
    </aside>
  );
}
