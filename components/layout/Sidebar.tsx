'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { PlusCircle } from 'lucide-react';
import { ROLE_NAV, ROLE_PRIMARY_ACTION, type NavBadges, type NavEntry } from '@/lib/navigation';
import { useI18n } from '@/components/i18n/LanguageProvider';
import type { I18n } from '@/lib/i18n';
import { navIcon } from './navIcons';

type SidebarProps = {
  role: UserRole;
  badges: NavBadges;
  userName: string;
  userCity?: string | null;
  aiHint?: string;
};

function badgeContent(item: NavEntry, badges: NavBadges, t: I18n['t']) {
  if (!item.badge) return null;
  const value = badges[item.badge] ?? 0;
  if (!value) return null;

  if (item.badgeStyle === 'live') {
    return { text: t('sidebar.live'), className: 'bg-agri-900 text-white animate-pulse' };
  }
  if (item.badgeStyle === 'accent') {
    return { text: String(value), className: 'bg-[#E8F3EE] text-agri-900 border border-[#B7D4C8]' };
  }
  return { text: String(value), className: 'bg-agri-900 text-white' };
}

export default function Sidebar({ role, badges, userName, userCity, aiHint }: SidebarProps) {
  const pathname = usePathname() ?? '';
  const { t, nav, navSection, role: roleName } = useI18n();
  const sections = ROLE_NAV[role] ?? [];
  const primaryAction = ROLE_PRIMARY_ACTION[role];
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside className="hidden lg:flex flex-col w-72 bg-white text-charcoal border-e border-[#E5E7EB] shrink-0 select-none">
      {primaryAction && (
        <div className="p-4 border-b border-[#E5E7EB]">
          <Link
            href={primaryAction.href}
            className="w-full flex items-center justify-center gap-2 bg-agri-900 hover:bg-agri-800 text-white py-3 px-3 rounded-lg text-base font-semibold shadow-xs transition-all active:scale-95"
          >
            <PlusCircle className="w-5 h-5 text-emerald-200" />
            <span>{nav(primaryAction.label, role)}</span>
          </Link>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-[#636E72]">
              {navSection(section.title)}
            </div>
            {section.items.map((item) => {
              const Icon = navIcon(item.icon);
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const badge = badgeContent(item, badges, t);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-base font-medium transition-all text-start ${
                    isActive
                      ? 'bg-[#E8F3EE] text-agri-900 font-semibold shadow-sm'
                      : 'text-[#636E72] hover:bg-[#F8F9F5] hover:text-charcoal'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-6 h-6 shrink-0 ${isActive ? 'text-agri-900' : 'text-[#636E72]'}`}
                    />
                    <span className="min-w-0 truncate">{nav(item.label, role)}</span>
                  </div>
                  {badge && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-md font-semibold uppercase ${badge.className}`}
                    >
                      {badge.text}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-[#E5E7EB] bg-white text-base">
        {aiHint && (
          <div className="bg-[#F8F9F5] p-3 rounded-xl border border-[#E5E7EB] mb-3">
            <div className="text-xs uppercase tracking-wider text-[#636E72] font-bold mb-1">
              {t('sidebar.aiTitle')}
            </div>
            <p className="text-base leading-relaxed text-charcoal">{aiHint}</p>
          </div>
        )}

        <div className="flex items-center gap-3 px-1">
          <div className="w-9 h-9 rounded-full bg-agri-900 flex items-center justify-center text-white font-bold text-base shrink-0">
            {initials || '?'}
          </div>
          <div className="overflow-hidden flex-1">
            <div className="text-base font-bold text-charcoal truncate">{userName}</div>
            <div className="text-xs text-[#636E72] truncate">
              {roleName(role)}
              {userCity ? ` • ${userCity}` : ''}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
