'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { PlusCircle } from 'lucide-react';
import { ROLE_NAV, ROLE_PRIMARY_ACTION, type NavBadges, type NavEntry } from '@/lib/navigation';
import { ROLE_LABEL, ROLE_LABEL_URDU } from '@/lib/permissions';
import { navIcon } from './navIcons';

type SidebarProps = {
  role: UserRole;
  badges: NavBadges;
  userName: string;
  userCity?: string | null;
  aiHint?: string;
};

function badgeContent(item: NavEntry, badges: NavBadges) {
  if (!item.badge) return null;
  const value = badges[item.badge] ?? 0;
  if (!value) return null;

  if (item.badgeStyle === 'live') {
    return { text: 'LIVE', className: 'bg-agri-900 text-white animate-pulse' };
  }
  if (item.badgeStyle === 'accent') {
    return { text: String(value), className: 'bg-[#E8F3EE] text-agri-900 border border-[#B7D4C8]' };
  }
  return { text: String(value), className: 'bg-agri-900 text-white' };
}

export default function Sidebar({ role, badges, userName, userCity, aiHint }: SidebarProps) {
  const pathname = usePathname() ?? '';
  const sections = ROLE_NAV[role] ?? [];
  const primaryAction = ROLE_PRIMARY_ACTION[role];
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white text-charcoal border-r border-[#E5E7EB] shrink-0 select-none">
      {primaryAction && (
        <div className="p-4 border-b border-[#E5E7EB]">
          <Link
            href={primaryAction.href}
            className="w-full flex items-center justify-center gap-2 bg-agri-900 hover:bg-agri-800 text-white py-2.5 px-3 rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4 text-emerald-200" />
            <span>{primaryAction.label}</span>
          </Link>
          <p className="text-[10px] text-[#636E72] text-center mt-1.5">{primaryAction.labelUrdu}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#636E72]">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = navIcon(item.icon);
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const badge = badgeContent(item, badges);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                    isActive
                      ? 'bg-[#E8F3EE] text-agri-900 font-semibold shadow-sm'
                      : 'text-[#636E72] hover:bg-[#F8F9F5] hover:text-charcoal'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${isActive ? 'text-agri-900' : 'text-[#636E72]'}`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold uppercase ${badge.className}`}
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

      <div className="p-4 border-t border-[#E5E7EB] bg-white text-xs">
        {aiHint && (
          <div className="bg-[#F8F9F5] p-3 rounded-xl border border-[#E5E7EB] mb-3">
            <div className="text-[10px] uppercase tracking-wider text-[#636E72] font-bold mb-1">
              AgriConnect AI
            </div>
            <p className="text-xs leading-relaxed text-charcoal">{aiHint}</p>
          </div>
        )}

        <div className="flex items-center gap-3 px-1">
          <div className="w-9 h-9 rounded-full bg-agri-900 flex items-center justify-center text-white font-bold text-xs shrink-0">
            {initials || '?'}
          </div>
          <div className="overflow-hidden flex-1">
            <div className="text-xs font-bold text-charcoal truncate">{userName}</div>
            <div className="text-[10px] text-[#636E72] truncate">
              {ROLE_LABEL[role]}
              {userCity ? ` • ${userCity}` : ''}
            </div>
          </div>
          <span className="text-[10px] bg-[#E8F3EE] text-agri-900 font-medium px-1.5 py-0.5 rounded border border-[#B7D4C8]">
            {ROLE_LABEL_URDU[role]}
          </span>
        </div>
      </div>
    </aside>
  );
}
