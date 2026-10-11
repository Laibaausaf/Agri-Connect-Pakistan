'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { ROLE_MOBILE_NAV, type NavBadges } from '@/lib/navigation';
import { navIcon } from './navIcons';

type MobileNavProps = {
  role: UserRole;
  badges: NavBadges;
};

export default function MobileNav({ role, badges }: MobileNavProps) {
  const pathname = usePathname() ?? '';
  const items = ROLE_MOBILE_NAV[role] ?? [];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E5E7EB] text-[#636E72] py-1.5 px-2 safe-area-inset-bottom shadow-md">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = navIcon(item.icon);
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const count = item.badge ? badges[item.badge] ?? 0 : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition-colors relative ${
                isActive
                  ? 'text-agri-900 font-semibold bg-[#E8F3EE]'
                  : 'text-[#636E72] hover:text-charcoal'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-agri-900' : 'text-[#636E72]'}`} />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 bg-agri-900 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </div>
              <span className="mt-0.5 max-w-full truncate text-[10px] leading-tight tracking-tight">{item.label}</span>{role === UserRole.FARMER && <span className="max-w-full truncate text-[9px] leading-tight opacity-75">{item.labelUrdu}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
